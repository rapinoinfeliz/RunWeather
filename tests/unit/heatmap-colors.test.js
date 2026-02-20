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

    it('uses temperature shades for ideal impact', () => {
        const warm = getImpactColor(0.2, 9);
        const cool = getImpactColor(0.2, 5);
        const cold = getImpactColor(0.2, 1);

        expect(warm).toMatch(/^#[0-9a-f]{6}$/i);
        expect(cool).toMatch(/^#[0-9a-f]{6}$/i);
        expect(cold).toMatch(/^#[0-9a-f]{6}$/i);
        expect(warm).not.toBe(cool);
        expect(cool).not.toBe(cold);

        const warmRgb = hexToRgb(warm);
        const coolRgb = hexToRgb(cool);
        const coldRgb = hexToRgb(cold);
        expect(coolRgb.b).toBeGreaterThanOrEqual(warmRgb.b);
        expect(coldRgb.b).toBeGreaterThan(coolRgb.b);
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

    it('uses temperature shades for ideal heatmap cells', () => {
        const warm = getImpactHeatmapColor(0.2, 8);
        const cool = getImpactHeatmapColor(0.2, 5);
        const cold = getImpactHeatmapColor(0.2, 1);
        expect(warm).not.toBe(cool);
        expect(cool).not.toBe(cold);
    });

    it('darkens inside ideal subcategories as impact rises', () => {
        const lowCool = getImpactHeatmapColor(0.05, 5);
        const highCool = getImpactHeatmapColor(0.45, 5);
        expect(luminance(highCool)).toBeLessThan(luminance(lowCool));

        const lowCold = getImpactHeatmapColor(0.05, 1);
        const highCold = getImpactHeatmapColor(0.45, 1);
        expect(luminance(highCold)).toBeLessThan(luminance(lowCold));
    });
});
