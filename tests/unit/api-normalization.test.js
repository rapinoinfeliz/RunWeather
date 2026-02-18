import { describe, expect, it } from 'vitest';
import {
    normalizeAirPayload,
    normalizeClimatePayload,
    normalizeWeatherPayload
} from '../../src/modules/api.js';

describe('api payload normalization', () => {
    it('normalizes weather payload with safe defaults', () => {
        const normalized = normalizeWeatherPayload({});

        expect(typeof normalized.timezone).toBe('string');
        expect(normalized.elevation).toBe(0);
        expect(normalized.current).toBeTypeOf('object');
        expect(Array.isArray(normalized.hourly.time)).toBe(true);
        expect(Array.isArray(normalized.daily.sunrise)).toBe(true);
    });

    it('pads uneven weather hourly arrays to a shared length', () => {
        const normalized = normalizeWeatherPayload({
            hourly: {
                time: ['2026-01-01T00:00'],
                temperature_2m: [24.2],
                dew_point_2m: [20.1, 20.4, 20.8],
                precipitation: [0.2, 0.5]
            }
        });

        expect(normalized.hourly.time.length).toBe(3);
        expect(normalized.hourly.temperature_2m.length).toBe(3);
        expect(normalized.hourly.dew_point_2m.length).toBe(3);
        expect(normalized.hourly.precipitation.length).toBe(3);
        expect(normalized.hourly.temperature_2m[1]).toBeNull();
        expect(normalized.hourly.precipitation[2]).toBeNull();
    });

    it('normalizes air payload from current and top-level shapes', () => {
        const withCurrent = normalizeAirPayload({ current: { us_aqi: 42, pm2_5: 11.3 } });
        expect(withCurrent.current.us_aqi).toBe(42);
        expect(withCurrent.current.pm2_5).toBe(11.3);

        const topLevel = normalizeAirPayload({ us_aqi: 55, pm2_5: 16.1 });
        expect(topLevel.current.us_aqi).toBe(55);
        expect(topLevel.current.pm2_5).toBe(16.1);
    });

    it('normalizes climate archive payload and aligns hourly vectors', () => {
        const normalized = normalizeClimatePayload({
            timezone: 'America/Sao_Paulo',
            hourly: {
                time: ['2026-01-01T00:00', '2026-01-01T01:00'],
                temperature_2m: [23.1],
                wind_speed_10m: [8.2, 8.4, 8.8]
            }
        });

        expect(normalized.timezone).toBe('America/Sao_Paulo');
        expect(normalized.hourly.time.length).toBe(3);
        expect(normalized.hourly.temperature_2m.length).toBe(3);
        expect(normalized.hourly.wind_speed_10m.length).toBe(3);
        expect(normalized.hourly.temperature_2m[2]).toBeNull();
    });
});
