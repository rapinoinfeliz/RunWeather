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
});
