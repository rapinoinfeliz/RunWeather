import { describe, expect, it } from 'vitest';
import { HAPCalculator } from '../../src/modules/core.js';
import { calculatePacingState } from '../../src/modules/engine.js';
import { HAP_GRID } from '../../data/hap_grid.js';

const hapCalc = new HAPCalculator(HAP_GRID);

function makeInputs(overrides = {}) {
    return {
        distance: 5000,
        timeSec: 1200,
        temp: 22,
        dew: 16,
        wind: 0,
        runnerWeight: 65,
        baseAltitude: 0,
        currentElevation: 0,
        ...overrides
    };
}

describe('engine pacing state', () => {
    it('returns invalid state for missing or zero inputs', () => {
        const res = calculatePacingState(makeInputs({ distance: 0 }), hapCalc);
        expect(res.valid).toBe(false);
        expect(res.vdot).toBe(0);
        expect(res.paces.threshold).toBe(0);
    });

    it('computes coherent baseline paces from a valid TT', () => {
        const res = calculatePacingState(makeInputs(), hapCalc);
        expect(res.valid).toBe(true);
        expect(res.vdot).toBeGreaterThan(0);
        expect(res.pred5kSec).toBeGreaterThan(0);
        expect(res.inputPaceSec).toBeCloseTo(240, 3);

        // Faster reps => lower sec/km.
        expect(res.paces.p1min).toBeLessThan(res.paces.p3min);
        expect(res.paces.p3min).toBeLessThan(res.paces.p6min);
        expect(res.paces.p6min).toBeLessThan(res.paces.p10min);

        // Easy pace should be slower than threshold pace.
        expect(res.paces.easy).toBeGreaterThan(res.paces.threshold);
    });

    it('applies heat adjustments and positive impact in hot/humid conditions', () => {
        const res = calculatePacingState(makeInputs({
            temp: 35,
            dew: 26
        }), hapCalc);

        expect(res.weather.valid).toBe(true);
        expect(res.weather.impactPct).toBeGreaterThan(0);
        expect(res.weather.adjustedPaces.threshold).toBeGreaterThan(res.paces.threshold);
        expect(res.weather.adjustedPaces.easy).toBeGreaterThan(res.paces.easy);
    });

    it('computes wind head/tail impacts with opposite signs', () => {
        const res = calculatePacingState(makeInputs({
            wind: 22,
            runnerWeight: 68
        }), hapCalc);

        expect(res.weather.valid).toBe(true);
        expect(res.weather.windImpact.headwindPct).toBeGreaterThan(0);
        expect(res.weather.windImpact.tailwindPct).toBeLessThan(0);
        expect(res.weather.windPaces.threshold.headwind).toBeGreaterThan(res.paces.threshold);
        expect(res.weather.windPaces.threshold.tailwind).toBeLessThan(res.paces.threshold);
    });

    it('enables altitude effects only for meaningful elevation deltas', () => {
        const flat = calculatePacingState(makeInputs({
            baseAltitude: 100,
            currentElevation: 160
        }), hapCalc);
        expect(flat.altitude.valid).toBe(false);

        const uphill = calculatePacingState(makeInputs({
            baseAltitude: 100,
            currentElevation: 900
        }), hapCalc);
        expect(uphill.altitude.valid).toBe(true);
        expect(uphill.altitude.impactPct).toBeGreaterThan(0);
        expect(uphill.altitude.adjustedPaces.threshold).toBeGreaterThan(uphill.paces.threshold);

        const downhill = calculatePacingState(makeInputs({
            baseAltitude: 900,
            currentElevation: 100
        }), hapCalc);
        expect(downhill.altitude.valid).toBe(true);
        expect(downhill.altitude.impactPct).toBeLessThan(0);
        expect(downhill.altitude.adjustedPaces.threshold).toBeLessThan(downhill.paces.threshold);
    });
});
