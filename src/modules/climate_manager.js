import { getCachedClimate, cacheClimate } from './storage.js';
import { fetchClimateHistory } from './api.js';
import { AppState } from './appState.js';

export class ClimateManager {
    constructor(locManager, onUpdateUI) {
        this.data = [];
        this.locManager = locManager;
        this.onUpdateUI = onUpdateUI;
    }

    async loadDataForCurrentLocation() {
        const loc = this.locManager.current;
        if (!loc) return;

        // 1. Check Cache
        const cached = await getCachedClimate(loc.lat, loc.lon);
        // Check if cache fits schema (has mean_temp)
        if (cached && cached.length > 0 && cached[0].mean_temp !== undefined) {
            console.log("Loaded Climate from Cache");
            this.data = cached;
            if (this.onUpdateUI) this.onUpdateUI(cached);
            return cached;
        }

        // 2. Fetch
        try {
            const raw = await fetchClimateHistory(loc.lat, loc.lon);
            const processed = this.processHistory(raw);

            if (processed && processed.length > 0) {
                await cacheClimate(loc.lat, loc.lon, processed);
                this.data = processed;
                if (this.onUpdateUI) this.onUpdateUI(processed);
                return processed;
            }
        } catch (e) {
            console.error("Climate Fetch Error", e);
            // If we have cache, we are fine, otherwise throw
            if (this.data && this.data.length > 0) {
                console.log("Using cached data due to fetch error");
                return this.data;
            }
            throw e;
        }
    }


    processHistory(raw) {
        if (!raw || !raw.hourly) return [];
        const h = raw.hourly;
        const len = h.time.length;

        const buckets = {};

        for (let i = 0; i < len; i++) {
            const t = new Date(h.time[i]);
            // Week number logic needed...
            const d = new Date(Date.UTC(t.getFullYear(), t.getMonth(), t.getDate()));
            const dayNum = d.getUTCDay() || 7;
            d.setUTCDate(d.getUTCDate() + 4 - dayNum);
            const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
            const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
            const week = weekNo;

            const hour = t.getHours();
            const key = `${week}-${hour}`;

            if (!buckets[key]) buckets[key] = {
                temps: [], dews: [], winds: [], precips: 0, count: 0
            };

            if (h.temperature_2m[i] !== null) buckets[key].temps.push(h.temperature_2m[i]);
            if (h.dew_point_2m[i] !== null) buckets[key].dews.push(h.dew_point_2m[i]);
            if (h.wind_speed_10m[i] !== null) buckets[key].winds.push(h.wind_speed_10m[i]);
            if (h.precipitation[i] !== null) buckets[key].precips += h.precipitation[i];
            buckets[key].count++;
        }

        const result = [];
        for (const key in buckets) {
            const b = buckets[key];
            if (b.count === 0) continue;

            const avgTemp = b.temps.reduce((a, c) => a + c, 0) / (b.temps.length || 1);
            const avgDew = b.dews.reduce((a, c) => a + c, 0) / (b.dews.length || 1);
            const avgWind = b.winds.reduce((a, c) => a + c, 0) / (b.winds.length || 1);

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
                mean_precip: b.precips / (b.count || 1),
                mean_impact: impact,
                samples: b.count
            });
        }
        return result;
    }
}
