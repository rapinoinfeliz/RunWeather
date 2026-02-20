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
    'wind_direction_10m',
    'weather_code'
];

const BR_STATES = [
    { uf: 'AC', name: 'Acre' },
    { uf: 'AL', name: 'Alagoas' },
    { uf: 'AP', name: 'Amapa' },
    { uf: 'AM', name: 'Amazonas' },
    { uf: 'BA', name: 'Bahia' },
    { uf: 'CE', name: 'Ceara' },
    { uf: 'DF', name: 'Distrito Federal' },
    { uf: 'ES', name: 'Espirito Santo' },
    { uf: 'GO', name: 'Goias' },
    { uf: 'MA', name: 'Maranhao' },
    { uf: 'MT', name: 'Mato Grosso' },
    { uf: 'MS', name: 'Mato Grosso do Sul' },
    { uf: 'MG', name: 'Minas Gerais' },
    { uf: 'PA', name: 'Para' },
    { uf: 'PB', name: 'Paraiba' },
    { uf: 'PR', name: 'Parana' },
    { uf: 'PE', name: 'Pernambuco' },
    { uf: 'PI', name: 'Piaui' },
    { uf: 'RJ', name: 'Rio de Janeiro' },
    { uf: 'RN', name: 'Rio Grande do Norte' },
    { uf: 'RS', name: 'Rio Grande do Sul' },
    { uf: 'RO', name: 'Rondonia' },
    { uf: 'RR', name: 'Roraima' },
    { uf: 'SC', name: 'Santa Catarina' },
    { uf: 'SP', name: 'Sao Paulo' },
    { uf: 'SE', name: 'Sergipe' },
    { uf: 'TO', name: 'Tocantins' }
];

const BR_STATE_BY_UF = BR_STATES.reduce((acc, state) => {
    acc[state.uf] = state.name;
    return acc;
}, {});

const BR_STATE_UFS = Object.keys(BR_STATE_BY_UF);
const BR_STATES_SORTED = BR_STATES
    .map((state) => ({ ...state, normalized: normalizeSearchText(state.name) }))
    .sort((a, b) => b.normalized.length - a.normalized.length);

function normalizeSearchText(value) {
    return String(value || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

function escapeRegExp(value) {
    return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function parseBrazilSearchQuery(rawQuery) {
    const original = String(rawQuery || '').trim();
    if (!original) {
        return { searchTerm: '', stateUf: '', stateName: '' };
    }

    let searchTerm = original;
    let stateUf = '';

    const ufPattern = new RegExp(`(?:^|[\\s,\\-/])(${BR_STATE_UFS.join('|')})$`, 'i');
    const ufMatch = searchTerm.match(ufPattern);
    if (ufMatch) {
        stateUf = ufMatch[1].toUpperCase();
        searchTerm = searchTerm.slice(0, ufMatch.index).trim();
    }

    let normalizedSearch = normalizeSearchText(searchTerm);
    if (!stateUf && normalizedSearch) {
        for (const state of BR_STATES_SORTED) {
            const statePatternEnd = new RegExp(`(?:^|[\\s,\\-/])${escapeRegExp(state.normalized)}$`);
            if (statePatternEnd.test(normalizedSearch)) {
                stateUf = state.uf;
                normalizedSearch = normalizedSearch.replace(statePatternEnd, '').trim();
                break;
            }
        }
    }

    // If we identified a state by name, use normalized city term (without UF/state suffix).
    if (stateUf && normalizedSearch) {
        searchTerm = normalizedSearch;
    }

    if (!searchTerm) searchTerm = original;

    return {
        searchTerm: searchTerm.trim(),
        stateUf,
        stateName: stateUf ? (BR_STATE_BY_UF[stateUf] || '') : ''
    };
}

function isBrazilResult(item) {
    const countryCode = String(item && (item.country_code || item.countryCode) || '').toUpperCase();
    const countryName = normalizeSearchText(item && item.country);
    return countryCode === 'BR' || countryName === 'brazil' || countryName === 'brasil';
}

function scoreSearchResult(item, searchNorm, stateUf = '') {
    const nameNorm = normalizeSearchText(item && item.name);
    const adminNorm = normalizeSearchText(item && item.admin1);

    let score = 0;

    if (searchNorm && nameNorm === searchNorm) score += 120;
    else if (searchNorm && nameNorm.startsWith(searchNorm)) score += 90;
    else if (searchNorm && nameNorm.includes(searchNorm)) score += 45;

    if (isBrazilResult(item)) score += 25;

    if (stateUf) {
        const stateNorm = normalizeSearchText(BR_STATE_BY_UF[stateUf] || '');
        if (adminNorm && adminNorm === stateNorm) score += 120;
        else score -= 20;
    }

    const population = Number(item && item.population);
    if (Number.isFinite(population) && population > 0) {
        score += Math.min(25, Math.log10(population + 1) * 4);
    }

    return score;
}

function dedupeAndSortResults(results, searchNorm, stateUf = '') {
    const input = Array.isArray(results) ? results : [];
    const seen = new Set();
    const deduped = [];

    for (const item of input) {
        if (!item || typeof item !== 'object') continue;
        const lat = Number(item.latitude);
        const lon = Number(item.longitude);
        const key = [
            normalizeSearchText(item.name),
            normalizeSearchText(item.admin1),
            String(item.country_code || item.countryCode || '').toUpperCase(),
            Number.isFinite(lat) ? lat.toFixed(3) : 'na',
            Number.isFinite(lon) ? lon.toFixed(3) : 'na'
        ].join('|');
        if (seen.has(key)) continue;
        seen.add(key);
        deduped.push(item);
    }

    return deduped.sort((a, b) => {
        const scoreDiff = scoreSearchResult(b, searchNorm, stateUf) - scoreSearchResult(a, searchNorm, stateUf);
        if (scoreDiff !== 0) return scoreDiff;
        const nameA = normalizeSearchText(a && a.name);
        const nameB = normalizeSearchText(b && b.name);
        if (nameA < nameB) return -1;
        if (nameA > nameB) return 1;
        return 0;
    });
}

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

    const wUrl = `${OPEN_METEO_BASE}/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,rain,weather_code,wind_speed_10m,wind_gusts_10m,wind_direction_10m,dew_point_2m,uv_index,shortwave_radiation,pressure_msl,cloud_cover&hourly=temperature_2m,dew_point_2m,precipitation_probability,precipitation,wind_speed_10m,wind_direction_10m,weather_code&daily=sunrise,sunset&timezone=auto&forecast_days=14&temperature_unit=celsius&wind_speed_unit=kmh&precipitation_unit=mm`;
    const aUrl = `${AIR_QUALITY_BASE}/air-quality?latitude=${lat}&longitude=${lon}&current=us_aqi,pm2_5&cell_selection=land&domains=auto&timezone=auto`;

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

    const url = `${ARCHIVE_BASE}/archive?latitude=${lat}&longitude=${lon}&start_date=${startStr}&end_date=${endStr}&hourly=temperature_2m,dew_point_2m,precipitation,wind_speed_10m&models=era5_seamless&timezone=auto`;

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
    const {
        signal,
        force = false,
        countryCode = '',
        count = 10
    } = opts;
    const parsed = parseBrazilSearchQuery(query);
    const normalized = (parsed.searchTerm || '').trim();
    if (normalized.length < 3) return [];

    const normalizedCountryCode = String(countryCode || '').trim().toUpperCase();
    const constrainedCountryCode = /^[A-Z]{2}$/.test(normalizedCountryCode) ? normalizedCountryCode : '';
    const parsedCount = Number(count);
    const safeCount = Number.isFinite(parsedCount)
        ? Math.max(1, Math.min(15, Math.trunc(parsedCount)))
        : 10;
    const searchNorm = normalizeSearchText(normalized);
    const poolCount = Math.max(safeCount * 8, 50);
    const safePoolCount = Math.min(100, poolCount);

    const cacheKey = `city:${searchNorm}:${constrainedCountryCode || 'auto'}:${parsed.stateUf || 'none'}:${safeCount}`;
    if (!force) {
        const cached = getCache(cacheKey);
        if (cached) return cached;
    }

    const fetchResults = async () => {
        const url = `${GEOCODING_BASE}/search?name=${encodeURIComponent(normalized)}&count=${safePoolCount}&language=pt&format=json`;
        const res = await fetch(url, { signal });
        if (!res.ok) return [];
        const data = await res.json();
        return Array.isArray(data.results) ? data.results : [];
    };

    try {
        const shouldUseBrFirst = !constrainedCountryCode || constrainedCountryCode === 'BR';
        const allResults = await fetchResults();
        let ranked = [];

        if (shouldUseBrFirst) {
            const brResults = allResults.filter((item) => isBrazilResult(item));
            ranked = dedupeAndSortResults(brResults, searchNorm, parsed.stateUf);
            if (ranked.length === 0) {
                ranked = dedupeAndSortResults(allResults, searchNorm, parsed.stateUf);
            }
        } else {
            const countryResults = allResults.filter((item) => {
                const code = String(item && (item.country_code || item.countryCode) || '').toUpperCase();
                return code === constrainedCountryCode;
            });
            ranked = dedupeAndSortResults(countryResults, searchNorm, parsed.stateUf);
            if (ranked.length === 0) {
                ranked = dedupeAndSortResults(allResults, searchNorm, parsed.stateUf);
            }
        }

        return setCache(cacheKey, ranked.slice(0, safeCount), CACHE_TTL.search);
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
        const adminList = Array.isArray(data && data.localityInfo && data.localityInfo.administrative)
            ? data.localityInfo.administrative
            : [];
        const subdivision = adminList.find((entry) => {
            const isoCode = String(entry && entry.isoCode || '');
            return entry && (entry.adminLevel === 4 || /^BR-[A-Z]{2}$/.test(isoCode));
        });
        const region = data.principalSubdivision
            || (subdivision && subdivision.name)
            || '';
        // BigDataCloud returns object directly: { city, locality, countryName, ... }
        // Map to our expected format: { name, country, region }
        return setCache(cacheKey, {
            name: data.city || data.locality || "Unknown",
            country: data.countryCode || data.countryName || "BR",
            region
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
