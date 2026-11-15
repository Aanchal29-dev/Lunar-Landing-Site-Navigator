import { defineConfig } from 'vite';

const backendTarget = process.env.LUNAR_COMPASS_API_TARGET ?? 'http://127.0.0.1:8000';

export default defineConfig({
    server: {
        host: '0.0.0.0',
        proxy: {
            '/api': backendTarget,
            '/health': backendTarget,
        },
    },
});
