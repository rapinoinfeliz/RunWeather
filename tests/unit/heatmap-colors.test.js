import { describe, expect, it } from 'vitest';
import {
    getImpactCategory,
    getImpactColor,
    getImpactHeatmapColor
} from '../../src/modules/ui/utils.js';

function hexToRgb(hex) {
    const match = hex.match(/^#([0-9a-f]{6})$/i);
    if (!match) return null;
    const n = parseInt(match[1], 16);
    return {
        r: (n >> 16) & 255,
        g: (n >> 8) & 255,
        b: n & 255
    };
}

function luminance(hex) {
    const rgb = hexToRgb(hex);
    if (!rgb) return 0;
    return (0.2126 * rgb.r) + (0.7152 * rgb.g) + (0.0722 * rgb.b);
}

describe('impact categories', () => {
    it('respects category thresholds', () => {
        expect(getImpactCategory(0.49)).toBe('Ideal');
        expect(getImpactCategory(0.5)).toBe('Good');
        expect(getImpactCategory(2.0)).toBe('Fair');
        expect(getImpactCategory(3.5)).toBe('Warning');
        expect(getImpactCategory(6.0)).toBe('Severe');
    });

    it('keeps legend palette stable at boundaries', () => {
        expect(getImpactColor(0.1)).toBe('#4ade80');
        expect(getImpactColor(1)).toBe('#facc15');
        expect(getImpactColor(3)).toBe('#fb923c');
        expect(getImpactColor(4)).toBe('#f87171');
        expect(getImpactColor(6.5)).toBe('#c084fc');
    });
});

describe('heatmap gradient', () => {
    it('returns hex colors for all impact ranges', () => {
        [0, 0.5, 2, 3.49, 5.99, 8].forEach((value) => {
            expect(getImpactHeatmapColor(value)).toMatch(/^#[0-9a-f]{6}$/i);
        });
    });

    it('darkens within the same band as impact rises', () => {
        const lowFair = getImpactHeatmapColor(2.0);
        const highFair = getImpactHeatmapColor(3.49);

        expect(lowFair).not.toBe(highFair);
        expect(luminance(highFair)).toBeLessThan(luminance(lowFair));
    });
});
