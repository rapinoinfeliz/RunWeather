import { describe, expect, it } from 'vitest';
import {
    calculateDescentBoost,
    calculatePaceAtAltitude,
    getAltitudeImpact,
    getVO2maxPercentage
} from '../../src/modules/altitude.js';
import { calculateWBGT } from '../../src/modules/engine.js';
import { WindCalc } from '../../src/modules/wind.js';

describe('altitude calculations', () => {
    it('reduces VO2 with higher altitude and clamps floor', () => {
        expect(getVO2maxPercentage(0)).toBeCloseTo(100, 3);
        expect(getVO2maxPercentage(2500)).toBeLessThan(getVO2maxPercentage(1000));
        expect(getVO2maxPercentage(50000)).toBe(50);
    });

    it('slows pace when ascending and speeds pace when descending', () => {
        const basePace = 300;
        const uphill = calculatePaceAtAltitude(basePace, 0, 2000);
        const downhill = calculatePaceAtAltitude(basePace, 2000, 0);
        expect(uphill).toBeGreaterThan(basePace);
        expect(downhill).toBeLessThan(basePace);
    });

    it('returns coherent altitude impact summary', () => {
        const impact = getAltitudeImpact(0, 2000);
        expect(impact.impactPct).toBeGreaterThan(0);
        expect(impact.deltaAlt).toBe(2000);
        expect(impact.baseVO2).toBeGreaterThan(impact.targetVO2);
    });

    it('caps descent boost at 3 percent', () => {
        const boost = calculateDescentBoost(300, 5000, 0);
        expect(boost.gainPercent).toBe(3);
        expect(boost.improvedPace).toBeLessThan(300);
    });
});

describe('wind and WBGT calculations', () => {
    it('adjusts speed by headwind/tailwind direction', () => {
        const baseSpeedMs = 1000 / 300;
        const headwindSpeed = WindCalc.calculateWindAdjustedPace(baseSpeedMs, 20, 65);
        const tailwindSpeed = WindCalc.calculateWindAdjustedPace(baseSpeedMs, -20, 65);

        expect(headwindSpeed).toBeLessThan(baseSpeedMs);
        expect(tailwindSpeed).toBeGreaterThan(baseSpeedMs);
        expect(WindCalc.getImpactPercentage(baseSpeedMs, 20, 65)).toBeGreaterThan(0);
        expect(WindCalc.getImpactPercentage(baseSpeedMs, -20, 65)).toBeLessThan(0);
    });

    it('increases WBGT for hotter and sunnier conditions', () => {
        const mild = calculateWBGT(20, 50, 12, 250);
        const harsh = calculateWBGT(30, 70, 5, 850);
        expect(harsh).toBeGreaterThan(mild);
    });
});
