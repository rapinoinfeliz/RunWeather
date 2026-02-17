const { test, expect } = require('@playwright/test');

test.describe('app smoke flow', () => {
    test('loads home and switches weather tabs', async ({ page }) => {
        await page.goto('/');
        await expect(page).toHaveTitle(/RunWeather/i);

        await expect(page.locator('#tab-calculator')).toHaveClass(/active/);
        await page.locator('[data-action="tab"][data-tab="forecast16"]').click();
        await expect(page.locator('#tab-forecast16')).toHaveClass(/active/);

        await page.locator('[data-action="tab"][data-tab="climate"]').click();
        await expect(page.locator('#tab-climate')).toHaveClass(/active/);
    });
});
