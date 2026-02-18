const { test, expect } = require('@playwright/test');

test.describe('visual regression', () => {
    test('heatmap gradient palette remains stable', async ({ page }) => {
        await page.goto('/tests/fixtures/visual-heatmap.html');
        const ramp = page.locator('#visual-ramp');
        await expect(ramp).toBeVisible();

        await expect(ramp).toHaveScreenshot('heatmap-gradient.png', {
            animations: 'disabled',
            caret: 'hide',
            maxDiffPixels: 8
        });
    });

    test('now indicator remains clearly visible', async ({ page }) => {
        await page.goto('/tests/fixtures/visual-now-indicator.html');
        const panel = page.locator('#visual-now');
        await expect(panel).toBeVisible();

        // Cross-platform text/antialiasing can vary slightly (macOS vs Linux CI).
        // Keep this guard focused on obvious regressions while avoiding CI flakes.
        await expect(panel).toHaveScreenshot('heatmap-now-indicator.png', {
            animations: 'disabled',
            caret: 'hide',
            maxDiffPixels: 120,
            maxDiffPixelRatio: 0.015
        });
    });
});
