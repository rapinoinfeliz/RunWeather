const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
    testDir: './tests/e2e',
    fullyParallel: true,
    retries: process.env.CI ? 2 : 0,
    workers: process.env.CI ? 1 : undefined,
    reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
    timeout: 30_000,
    expect: {
        timeout: 10_000
    },
    use: {
        baseURL: 'http://127.0.0.1:4173',
        viewport: { width: 1280, height: 720 },
        trace: 'retain-on-failure',
        screenshot: 'only-on-failure'
    },
    webServer: {
        command: 'npm run start -- --listen 4173',
        port: 4173,
        timeout: 120_000,
        reuseExistingServer: !process.env.CI
    },
    snapshotPathTemplate: '{testDir}/{testFilePath}-snapshots/{arg}{ext}'
});
