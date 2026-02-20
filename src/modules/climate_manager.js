import { getCachedClimate, cacheClimate } from './storage.js';
import { fetchClimateHistory } from './api.js';
import { AppState } from './appState.js';
import { RequestKeys, beginRequest, endRequest, isRequestCurrent } from './store.js';
import { getISOWeekFromYmd } from './time.js';

const CLIMATE_SCHEMA_VERSION = 3;

function parseLocalIsoParts(isoLike) {
    if (typeof isoLike !== 'string') return null;
    const match = isoLike.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2})/);
    if (!match) return null;

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const hour = Number(match[4]);

    if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day) || !Number.isFinite(hour)) {
        return null;
    }
    if (month < 1 || month > 12 || day < 1 || day > 31 || hour < 0 || hour > 23) {
        return null;
    }

    return { year, month, day, hour };
}

export class ClimateManager {
    constructor(locManager, onUpdateUI) {
        this.data = [];
        this.locManager = locManager;
        this.onUpdateUI = onUpdateUI;
        this.currentLoadKey = null;
        this.currentLoadPromise = null;
    }

    async loadDataForCurrentLocation() {
        const loc = this.locManager.current;
        if (!loc) return;
        const locKey = `${Number(loc.lat).toFixed(4)},${Number(loc.lon).toFixed(4)}`;

        // Reuse in-flight request for same location.
        if (this.currentLoadPromise && this.currentLoadKey === locKey) {
            return this.currentLoadPromise;
        }

        this.currentLoadKey = locKey;
        const request = beginRequest(RequestKeys.CLIMATE, {
            abortPrevious: true,
            meta: { lat: loc.lat, lon: loc.lon, key: locKey }
        });

        const runLoad = async () => {
            // 1. Check Cache
            const cached = await getCachedClimate(loc.lat, loc.lon);
            // Accept cache only when it matches the latest climate schema.
            if (
                cached
                && cached.length > 0
                && cached[0].mean_temp !== undefined
                && Number(cached[0].schema_version) === CLIMATE_SCHEMA_VERSION
            ) {
                console.log("Loaded Climate from Cache");
                this.data = cached;
                if (isRequestCurrent(RequestKeys.CLIMATE, request.seq) && this.onUpdateUI) this.onUpdateUI(cached);
                endRequest(RequestKeys.CLIMATE, request.seq, 'success');
                return cached;
            }

            // 2. Fetch
            try {
                const raw = await fetchClimateHistory(loc.lat, loc.lon, {
                    signal: request.signal
                });

                // Ignore stale responses from superseded requests.
                if (!isRequestCurrent(RequestKeys.CLIMATE, request.seq)) return this.data;

                const processed = this.processHistory(raw);

                if (processed && processed.length > 0) {
                    await cacheClimate(loc.lat, loc.lon, processed);
                    this.data = processed;
                    if (isRequestCurrent(RequestKeys.CLIMATE, request.seq) && this.onUpdateUI) this.onUpdateUI(processed);
                    endRequest(RequestKeys.CLIMATE, request.seq, 'success');
                    return processed;
                }
                endRequest(RequestKeys.CLIMATE, request.seq, 'success');
                return [];
            } catch (e) {
                if (e && e.name === 'AbortError') {
                    endRequest(RequestKeys.CLIMATE, request.seq, 'aborted');
                    return this.data;
                }
                endRequest(
                    RequestKeys.CLIMATE,
                    request.seq,
                    'error',
                    e && e.message ? e.message : 'Climate fetch failed'
                );
                console.error("Climate Fetch Error", e);
                // If we have cache, we are fine, otherwise throw
                if (this.data && this.data.length > 0) {
                    console.log("Using cached data due to fetch error");
                    return this.data;
                }
                throw e;
            }
        };

        const pending = runLoad()
            .finally(() => {
                if (this.currentLoadPromise === pending) {
                    this.currentLoadPromise = null;
                    this.currentLoadKey = null;
                }
            });
        this.currentLoadPromise = pending;

        return this.currentLoadPromise;
    }


    processHistory(raw) {
        if (!raw || !raw.hourly) return [];
        const h = raw.hourly;
        const len = Array.isArray(h.time) ? h.time.length : 0;
        const climateTimeZone = (typeof raw.timezone === 'string' && raw.timezone) ? raw.timezone : '';
        const climateUtcOffset = Number.isFinite(Number(raw.utc_offset_seconds))
            ? Number(raw.utc_offset_seconds)
            : null;

        const buckets = {};

        for (let i = 0; i < len; i++) {
            const parts = parseLocalIsoParts(h.time[i]);
            if (!parts) continue;

            // Archive API with timezone=auto returns local-time stamps for the location.
            // Parse components directly to avoid browser timezone shifts.
            const week = getISOWeekFromYmd(parts.year, parts.month, parts.day);
            const hour = parts.hour;
            const key = `${week}-${hour}`;

            if (!buckets[key]) buckets[key] = {
                temps: [], dews: [], winds: [], precips: 0, count: 0, precipCount: 0
            };

            const tempVal = h.temperature_2m[i];
            const dewVal = h.dew_point_2m[i];
            const windVal = h.wind_speed_10m[i];
            const precipVal = h.precipitation[i];

            if (tempVal !== null) {
                buckets[key].temps.push(tempVal);
                // Sample count should follow temperature availability, since heat-impact
                // computation is anchored in temperature/dew data.
                buckets[key].count++;
            }
            if (dewVal !== null) buckets[key].dews.push(dewVal);
            if (windVal !== null) buckets[key].winds.push(windVal);
            if (precipVal !== null) {
                buckets[key].precips += precipVal;
                buckets[key].precipCount++;
            }
        }

        const result = [];
        for (const key in buckets) {
            const b = buckets[key];
            if (b.count === 0) continue;

            const avgTemp = b.temps.length > 0
                ? b.temps.reduce((a, c) => a + c, 0) / b.temps.length
                : null;
            const avgDew = b.dews.length > 0
                ? b.dews.reduce((a, c) => a + c, 0) / b.dews.length
                : null;
            const avgWind = b.winds.length > 0
                ? b.winds.reduce((a, c) => a + c, 0) / b.winds.length
                : 0;
            if (avgTemp == null || avgDew == null) continue;

            // Impact Calculation
            let impact = 0;
            if (AppState.hapCalc) {
                const adj = AppState.hapCalc.getAdjustment(avgTemp, avgDew);
                // Impact % = ((1/ speedFactor) - 1) * 100
                // speedFactor = exp(adj)
                impact = ((1.0 / Math.exp(adj)) - 1.0) * 100.0;
                if (impact < 0) impact = 0;
            }

            result.push({
                id: key,
                week: parseInt(key.split('-')[0]),
                hour: parseInt(key.split('-')[1]),
                mean_temp: avgTemp,
                mean_dew: avgDew,
                mean_wind: avgWind,
                mean_precip: b.precipCount > 0 ? (b.precips / b.precipCount) : 0,
                mean_impact: impact,
                samples: b.count,
                timezone: climateTimeZone,
                utc_offset_seconds: climateUtcOffset,
                schema_version: CLIMATE_SCHEMA_VERSION
            });
        }
        return result;
    }
}
