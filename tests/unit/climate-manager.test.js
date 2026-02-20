import { describe, expect, it } from 'vitest';
import { ClimateManager } from '../../src/modules/climate_manager.js';

function getByKey(rows, week, hour) {
    return rows.find((row) => row.week === week && row.hour === hour) || null;
}

describe('ClimateManager.processHistory', () => {
    it('buckets archive timestamps by local ISO week/hour without runtime timezone shifts', () => {
        const manager = new ClimateManager(null, null);
        const raw = {
            timezone: 'America/Sao_Paulo',
            utc_offset_seconds: -10800,
            hourly: {
                time: [
                    '2025-12-29T15:00',
                    '2026-01-02T15:00',
                    '2026-01-05T03:00'
                ],
                temperature_2m: [20, 22, 24],
                dew_point_2m: [16, 17, 18],
                wind_speed_10m: [6, 7, 8],
                precipitation: [0.2, 0.4, 1.2]
            }
        };

        const out = manager.processHistory(raw);
        const wk1h15 = getByKey(out, 1, 15);
        const wk2h3 = getByKey(out, 2, 3);

        expect(wk1h15).toBeTruthy();
        expect(wk1h15.samples).toBe(2);
        expect(wk1h15.mean_temp).toBeCloseTo(21, 6);
        expect(wk1h15.mean_dew).toBeCloseTo(16.5, 6);
        expect(wk1h15.mean_wind).toBeCloseTo(6.5, 6);
        expect(wk1h15.mean_precip).toBeCloseTo(0.3, 6);
        expect(wk1h15.timezone).toBe('America/Sao_Paulo');
        expect(wk1h15.utc_offset_seconds).toBe(-10800);
        expect(wk1h15.schema_version).toBe(3);

        expect(wk2h3).toBeTruthy();
        expect(wk2h3.samples).toBe(1);
        expect(wk2h3.mean_temp).toBeCloseTo(24, 6);
        expect(wk2h3.mean_dew).toBeCloseTo(18, 6);
        expect(wk2h3.mean_wind).toBeCloseTo(8, 6);
        expect(wk2h3.mean_precip).toBeCloseTo(1.2, 6);
    });

    it('keeps wall-clock hour from timestamp text even when offset suffix is present', () => {
        const manager = new ClimateManager(null, null);
        const raw = {
            timezone: 'America/Sao_Paulo',
            utc_offset_seconds: -10800,
            hourly: {
                time: ['2026-02-20T15:00:00-03:00'],
                temperature_2m: [25],
                dew_point_2m: [20],
                wind_speed_10m: [10],
                precipitation: [0]
            }
        };

        const out = manager.processHistory(raw);
        expect(out).toHaveLength(1);
        expect(out[0].hour).toBe(15);
        expect(out[0].week).toBe(8);
        expect(out[0].timezone).toBe('America/Sao_Paulo');
        expect(out[0].utc_offset_seconds).toBe(-10800);
        expect(out[0].schema_version).toBe(3);
    });

    it('does not inflate samples/precip mean with null lag entries', () => {
        const manager = new ClimateManager(null, null);
        const raw = {
            timezone: 'America/Sao_Paulo',
            utc_offset_seconds: -10800,
            hourly: {
                time: [
                    '2026-02-17T15:00',
                    '2026-02-18T15:00',
                    '2026-02-19T15:00'
                ],
                temperature_2m: [22, null, null],
                dew_point_2m: [18, null, null],
                wind_speed_10m: [8, null, null],
                precipitation: [1.2, null, null]
            }
        };

        const out = manager.processHistory(raw);
        expect(out).toHaveLength(1);
        expect(out[0].week).toBe(8);
        expect(out[0].hour).toBe(15);
        expect(out[0].samples).toBe(1);
        expect(out[0].mean_precip).toBeCloseTo(1.2, 6);
    });
});
