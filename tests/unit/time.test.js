import { describe, expect, it } from 'vitest';
import {
    addDaysToIsoMinute,
    formatDateDdMm,
    formatUtcDateToIsoMinute,
    getDateForISOWeek,
    getISOWeekFromYmd,
    parseIsoMinuteToUtcDate
} from '../../src/modules/time.js';

describe('time utilities', () => {
    it('parses and formats naive ISO minute timestamps as UTC-safe values', () => {
        const date = parseIsoMinuteToUtcDate('2026-02-18T09:45');
        expect(date).toBeInstanceOf(Date);
        expect(date.getUTCFullYear()).toBe(2026);
        expect(date.getUTCMonth()).toBe(1);
        expect(date.getUTCDate()).toBe(18);
        expect(date.getUTCHours()).toBe(9);
        expect(date.getUTCMinutes()).toBe(45);
        expect(formatUtcDateToIsoMinute(date)).toBe('2026-02-18T09:45');
    });

    it('adds days on timezone-naive ISO strings without local timezone drift', () => {
        expect(addDaysToIsoMinute('2026-12-31T23:30', 1)).toBe('2027-01-01T23:30');
        expect(addDaysToIsoMinute('2026-01-01T00:00', -1)).toBe('2025-12-31T00:00');
    });

    it('computes ISO week from explicit Y-M-D inputs', () => {
        expect(getISOWeekFromYmd(2026, 1, 1)).toBe(1);
        expect(getISOWeekFromYmd(2026, 12, 31)).toBe(53);
    });

    it('maps ISO week to a stable week-start date', () => {
        const wk1 = getDateForISOWeek(1, 2026);
        expect(formatDateDdMm(wk1)).toBe('29/12');

        const wk10 = getDateForISOWeek(10, 2026);
        expect(wk10.getUTCMonth()).toBeGreaterThanOrEqual(1);
    });
});
