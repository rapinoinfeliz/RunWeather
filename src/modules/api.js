// API Module: Fetching Data from External Services

const OPEN_METEO_BASE = 'https://api.open-meteo.com/v1';
const AIR_QUALITY_BASE = 'https://air-quality-api.open-meteo.com/v1';
const GEOCODING_BASE = 'https://geocoding-api.open-meteo.com/v1';
const ARCHIVE_BASE = 'https://archive-api.open-meteo.com/v1';

export async function fetchWeatherData(lat, lon) {
    const wUrl = `${OPEN_METEO_BASE}/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,rain,weather_code,wind_speed_10m,wind_gusts_10m,wind_direction_10m,dew_point_2m,uv_index,shortwave_radiation,pressure_msl&hourly=temperature_2m,dew_point_2m,precipitation_probability,precipitation,wind_speed_10m,wind_gusts_10m,wind_direction_10m,shortwave_radiation,weather_code,pressure_msl&daily=sunrise,sunset&timezone=auto&forecast_days=14`;
    const aUrl = `${AIR_QUALITY_BASE}/air-quality?latitude=${lat}&longitude=${lon}&current=us_aqi,pm2_5&timezone=auto`;

    try {
        const [wRes, aRes] = await Promise.all([fetch(wUrl), fetch(aUrl)]);

        let weather = null;
        if (wRes.ok) weather = await wRes.json();

        let air = {};
        if (aRes.ok) air = await aRes.json();

        if (!weather) throw new Error("Weather API failed");

        return { weather, air };
    } catch (e) {
        console.error("fetchWeatherData error:", e);
        throw e;
    }
}

export async function fetchClimateHistory(lat, lon) {
    const end = new Date();
    const start = new Date();
    start.setFullYear(end.getFullYear() - 6);

    const startStr = start.toISOString().split('T')[0];
    const endStr = new Date().toISOString().split('T')[0];

    const url = `${ARCHIVE_BASE}/archive?latitude=${lat}&longitude=${lon}&start_date=${startStr}&end_date=${endStr}&hourly=temperature_2m,dew_point_2m,precipitation,wind_speed_10m&timezone=auto`;

    try {
        const res = await fetch(url);
        if (!res.ok) throw new Error("Climate Archive API failed");
        return await res.json();
    } catch (e) {
        console.error("fetchClimateHistory error:", e);
        throw e;
    }
}

export async function searchCity(query) {
    if (!query || query.length < 3) return [];
    const url = `${GEOCODING_BASE}/search?name=${encodeURIComponent(query)}&count=5&language=pt&format=json`;
    try {
        const res = await fetch(url);
        const data = await res.json();
        return data.results || [];
    } catch (e) {
        console.error("searchCity error:", e);
        return [];
    }

}

export async function reverseGeocode(lat, lon) {
    // Open-Meteo does not support reverse geocoding on the free tier endpoint correctly or it is structured differently.
    // Switching to BigDataCloud (Free, robust, no-key)
    const url = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=pt`;
    try {
        const res = await fetch(url);
        if (!res.ok) throw new Error("Reverse Geocoding failed");
        const data = await res.json();
        // BigDataCloud returns object directly: { city, locality, countryName, ... }
        // Map to our expected format: { name: "City", country: "CountryCode" }
        return {
            name: data.city || data.locality || "Unknown",
            country: data.countryCode || data.countryName || "BR"
        };
    } catch (e) {
        console.error("reverseGeocode error:", e);
        return null;
    }
}

export async function fetchIpLocation() {
    try {
        const res = await fetch('https://ipwho.is/');
        if (!res.ok) return null;
        const data = await res.json();
        if (data.success) {
            return {
                lat: data.latitude,
                lon: data.longitude,
                name: data.city,
                country: data.country
            };
        }
        return null;
    } catch (e) {
        console.error("fetchIpLocation error:", e);
        return null;
    }
}
