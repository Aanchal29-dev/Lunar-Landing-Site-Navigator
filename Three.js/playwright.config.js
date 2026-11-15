import { defineConfig } from '@playwright/test';

const port = process.env.LUNAR_COMPASS_E2E_PORT ?? '5188';
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
    testDir: './tests/browser',
    workers: 1,
    timeout: 45000,
    use: {
        baseURL,
        viewport: { width: 1440, height: 1000 },
        trace: 'retain-on-failure',
        launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] },
    },
    webServer: {
        command: `npm run dev -- --host 127.0.0.1 --port ${port} --strictPort`,
        url: baseURL,
        reuseExistingServer: false,
        timeout: 30000,
    },
});
