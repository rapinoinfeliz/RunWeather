import { describe, expect, it } from 'vitest';
import { VDOT_MATH, formatTime, getEasyPace, parseTime } from '../../src/modules/core.js';

describe('core time parsing/formatting', () => {
    it('parses compact and colon formats', () => {
        expect(parseTime('19:20')).toBe(1160);
        expect(parseTime('1920')).toBe(1160);
        expect(parseTime('30')).toBe(30);
        expect(parseTime('1:02:03')).toBe(3723);
        expect(parseTime('abc')).toBe(0);
    });

    it('formats pace with rounding and invalid guards', () => {
        expect(formatTime(300)).toBe('5:00');
        expect(formatTime(359.6)).toBe('6:00');
        expect(formatTime(0)).toBe('--:--');
        expect(formatTime(Number.NaN)).toBe('--:--');
    });
});

describe('core physiology math', () => {
    it('keeps VDOT solveTime consistent with calculateVDOT', () => {
        const target = 1200;
        const vdot = VDOT_MATH.calculateVDOT(5000, target);
        const solved = VDOT_MATH.solveTime(vdot, 5000);
        expect(solved).toBeCloseTo(target, 0);
    });

    it('interpolates easy pace within known bounds', () => {
        expect(getEasyPace(920)).toBe(262);
        expect(getEasyPace(930)).toBeCloseTo(265, 2);
        expect(getEasyPace(1800)).toBe(514);
    });
});
