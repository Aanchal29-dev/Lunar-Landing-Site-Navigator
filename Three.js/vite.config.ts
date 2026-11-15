import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const backendTarget = process.env.LUNAR_COMPASS_API_TARGET ?? "http://127.0.0.1:8000";

export default defineConfig({
  plugins: [react()],
  build: {
    // Three.js is intentionally loaded only when the coordinate globe mounts.
    // Its isolated async bundle can exceed Vite's generic 500 kB advisory.
    chunkSizeWarningLimit: 900,
  },
  server: {
    proxy: {
      "/api": backendTarget,
      "/health": backendTarget,
    },
  },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
