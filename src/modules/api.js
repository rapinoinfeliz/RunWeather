// API Module: Fetching Data from External Services

const OPEN_METEO_BASE = 'https://api.open-meteo.com/v1';
const AIR_QUALITY_BASE = 'https://air-quality-api.open-meteo.com/v1';
const GEOCODING_BASE = 'https://geocoding-api.open-meteo.com/v1';
const ARCHIVE_BASE = 'https://archive-api.open-meteo.com/v1';

const MEM_CACHE = new Map();
const CACHE_TTL = {
    weather: 2 * 60 * 1000,          // 2 min
    climate: 12 * 60 * 60 * 1000,    // 12 h
    search: 10 * 60 * 1000,          // 10 min
    reverse: 24 * 60 * 60 * 1000,    // 24 h
    ip: 15 * 60 * 1000               // 15 min
};

const WEATHER_CURRENT_KEYS = [
    'temperature_2m',
    'relative_humidity_2m',
    'apparent_temperature',
    'precipitation',
    'rain',
    'weather_code',
    'wind_speed_10m',
    'wind_gusts_10m',
    'wind_direction_10m',
    'dew_point_2m',
    'uv_index',
    'shortwave_radiation',
    'pressure_msl',
    'cloud_cover'
];

const WEATHER_HOURLY_KEYS = [
    'temperature_2m',
    'dew_point_2m',
    'precipitation_probability',
    'precipitation',
    'wind_speed_10m',
    'wind_gusts_10m',
    'wind_direction_10m',
    'shortwave_radiation',
    'weather_code',
    'pressure_msl'
];

function toFiniteNumber(value) {
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
}

function normalizeNumberArray(input, length) {
    const source = Array.isArray(input) ? input : [];
    const out = new Array(length);
    for (let i = 0; i < length; i++) {
        out[i] = toFiniteNumber(source[i]);
    }
    return out;
}

function normalizeStringArray(input, length) {
    const source = Array.isArray(input) ? input : [];
    const out = new Array(length);
    for (let i = 0; i < length; i++) {
        const val = source[i];
        out[i] = (typeof val === 'string' && val.length > 0) ? val : '';
    }
    return out;
}

function getRuntimeTimeZone() {
    try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    } catch {
        return 'UTC';
    }
}

function computeArrayLength(obj, keys = []) {
    const candidates = [0];
    keys.forEach((key) => {
        if (obj && Array.isArray(obj[key])) {
            candidates.push(obj[key].length);
        }
    });
    return Math.max(...candidates);
}

export function normalizeWeatherPayload(raw) {
    const root = (raw && typeof raw === 'object') ? raw : {};
    const currentRaw = (root.current && typeof root.current === 'object') ? root.current : {};
    const hourlyRaw = (root.hourly && typeof root.hourly === 'object') ? root.hourly : {};
    const dailyRaw = (root.daily && typeof root.daily === 'object') ? root.daily : {};

    const hourlyLen = computeArrayLength(hourlyRaw, ['time', ...WEATHER_HOURLY_KEYS]);
    const dailyLen = computeArrayLength(dailyRaw, ['time', 'sunrise', 'sunset']);

    const current = {};
    WEATHER_CURRENT_KEYS.forEach((key) => {
        current[key] = toFiniteNumber(currentRaw[key]);
    });

    const hourly = {
        time: normalizeStringArray(hourlyRaw.time, hourlyLen)
    };
    WEATHER_HOURLY_KEYS.forEach((key) => {
        hourly[key] = normalizeNumberArray(hourlyRaw[key], hourlyLen);
    });

    const daily = {
        time: normalizeStringArray(dailyRaw.time, dailyLen),
        sunrise: normalizeStringArray(dailyRaw.sunrise, dailyLen),
        sunset: normalizeStringArray(dailyRaw.sunset, dailyLen)
    };

    return {
        ...root,
        timezone: (typeof root.timezone === 'string' && root.timezone) ? root.timezone : getRuntimeTimeZone(),
        elevation: toFiniteNumber(root.elevation) ?? 0,
        current,
        hourly,
        daily
    };
}

export function normalizeAirPayload(raw) {
    const root = (raw && typeof raw === 'object') ? raw : {};
    const currentRaw = (root.current && typeof root.current === 'object')
        ? root.current
        : root;

    return {
        ...root,
        current: {
            us_aqi: toFiniteNumber(currentRaw.us_aqi),
            pm2_5: toFiniteNumber(currentRaw.pm2_5)
        }
    };
}

export function normalizeClimatePayload(raw) {
    const root = (raw && typeof raw === 'object') ? raw : {};
    const hourlyRaw = (root.hourly && typeof root.hourly === 'object') ? root.hourly : {};
    const len = computeArrayLength(hourlyRaw, [
        'time',
        'temperature_2m',
        'dew_point_2m',
        'precipitation',
        'wind_speed_10m'
    ]);

    return {
        ...root,
        timezone: (typeof root.timezone === 'string' && root.timezone) ? root.timezone : getRuntimeTimeZone(),
        hourly: {
            time: normalizeStringArray(hourlyRaw.time, len),
            temperature_2m: normalizeNumberArray(hourlyRaw.temperature_2m, len),
            dew_point_2m: normalizeNumberArray(hourlyRaw.dew_point_2m, len),
            precipitation: normalizeNumberArray(hourlyRaw.precipitation, len),
            wind_speed_10m: normalizeNumberArray(hourlyRaw.wind_speed_10m, len)
        }
    };
}

function toCoordKey(val) {
    return Number(val).toFixed(4);
}

function getCache(key) {
    const entry = MEM_CACHE.get(key);
    if (!entry) return null;
    if (entry.expiresAt <= Date.now()) {
        MEM_CACHE.delete(key);
        return null;
    }
    return entry.value;
}

function setCache(key, value, ttlMs) {
    MEM_CACHE.set(key, {
        value,
        expiresAt: Date.now() + ttlMs
    });
    return value;
}

export async function fetchWeatherData(lat, lon, opts = {}) {
    const { signal, force = false } = opts;
    const cacheKey = `weather:${toCoordKey(lat)}:${toCoordKey(lon)}`;
    if (!force) {
        const cached = getCache(cacheKey);
        if (cached) return cached;
    }

    const wUrl = `${OPEN_METEO_BASE}/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,rain,weather_code,wind_speed_10m,wind_gusts_10m,wind_direction_10m,dew_point_2m,uv_index,shortwave_radiation,pressure_msl,cloud_cover&hourly=temperature_2m,dew_point_2m,precipitation_probability,precipitation,wind_speed_10m,wind_gusts_10m,wind_direction_10m,shortwave_radiation,weather_code,pressure_msl&daily=sunrise,sunset&timezone=auto&forecast_days=14&temperature_unit=celsius&wind_speed_unit=kmh&precipitation_unit=mm&models=best_match,ecmwf_ifs04,gfs_seamless`;
    const aUrl = `${AIR_QUALITY_BASE}/air-quality?latitude=${lat}&longitude=${lon}&current=us_aqi,pm2_5&timezone=auto`;

    try {
        const [wRes, aRes] = await Promise.all([
            fetch(wUrl, { signal }),
            fetch(aUrl, { signal })
        ]);

        let weather = null;
        if (wRes.ok) weather = await wRes.json();

        let air = {};
        if (aRes.ok) air = await aRes.json();

        if (!weather) throw new Error("Weather API failed");

        return setCache(cacheKey, {
            weather: normalizeWeatherPayload(weather),
            air: normalizeAirPayload(air)
        }, CACHE_TTL.weather);
    } catch (e) {
        if (e && e.name === 'AbortError') throw e;
        console.error("fetchWeatherData error:", e);
        throw e;
    }
}

export async function fetchClimateHistory(lat, lon, opts = {}) {
    const { signal, force = false } = opts;
    const end = new Date();
    const start = new Date();
    start.setFullYear(end.getFullYear() - 6);

    const startStr = start.toISOString().split('T')[0];
    const endStr = new Date().toISOString().split('T')[0];
    const cacheKey = `climate:${toCoordKey(lat)}:${toCoordKey(lon)}:${startStr}:${endStr}`;
    if (!force) {
        const cached = getCache(cacheKey);
        if (cached) return cached;
    }

    const url = `${ARCHIVE_BASE}/archive?latitude=${lat}&longitude=${lon}&start_date=${startStr}&end_date=${endStr}&hourly=temperature_2m,dew_point_2m,precipitation,wind_speed_10m&timezone=auto`;

    try {
        const res = await fetch(url, { signal });
        if (!res.ok) throw new Error("Climate Archive API failed");
        const data = await res.json();
        return setCache(cacheKey, normalizeClimatePayload(data), CACHE_TTL.climate);
    } catch (e) {
        if (e && e.name === 'AbortError') throw e;
        console.error("fetchClimateHistory error:", e);
        throw e;
    }
}

export async function searchCity(query, opts = {}) {
    const { signal, force = false } = opts;
    const normalized = (query || '').trim();
    if (normalized.length < 3) return [];

    const cacheKey = `city:${normalized.toLowerCase()}`;
    if (!force) {
        const cached = getCache(cacheKey);
        if (cached) return cached;
    }

    const url = `${GEOCODING_BASE}/search?name=${encodeURIComponent(normalized)}&count=5&language=pt&format=json`;
    try {
        const res = await fetch(url, { signal });
        const data = await res.json();
        return setCache(cacheKey, data.results || [], CACHE_TTL.search);
    } catch (e) {
        if (e && e.name === 'AbortError') throw e;
        console.error("searchCity error:", e);
        return [];
    }

}

export async function reverseGeocode(lat, lon, opts = {}) {
    const { signal, force = false } = opts;
    const cacheKey = `reverse:${toCoordKey(lat)}:${toCoordKey(lon)}`;
    if (!force) {
        const cached = getCache(cacheKey);
        if (cached) return cached;
    }

    // Open-Meteo does not support reverse geocoding on the free tier endpoint correctly or it is structured differently.
    // Switching to BigDataCloud (Free, robust, no-key)
    const url = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=pt`;
    try {
        const res = await fetch(url, { signal });
        if (!res.ok) throw new Error("Reverse Geocoding failed");
        const data = await res.json();
        // BigDataCloud returns object directly: { city, locality, countryName, ... }
        // Map to our expected format: { name: "City", country: "CountryCode" }
        return setCache(cacheKey, {
            name: data.city || data.locality || "Unknown",
            country: data.countryCode || data.countryName || "BR"
        }, CACHE_TTL.reverse);
    } catch (e) {
        if (e && e.name === 'AbortError') throw e;
        console.error("reverseGeocode error:", e);
        return null;
    }
}

export async function fetchIpLocation(opts = {}) {
    const { signal, force = false } = opts;
    const cacheKey = 'ip_location';
    if (!force) {
        const cached = getCache(cacheKey);
        if (cached) return cached;
    }

    try {
        const res = await fetch('https://ipwho.is/', { signal });
        if (!res.ok) return null;
        const data = await res.json();
        if (data.success) {
            return setCache(cacheKey, {
                lat: data.latitude,
                lon: data.longitude,
                name: data.city,
                country: data.country
            }, CACHE_TTL.ip);
        }
        return null;
    } catch (e) {
        if (e && e.name === 'AbortError') throw e;
        console.error("fetchIpLocation error:", e);
        return null;
    }
}
