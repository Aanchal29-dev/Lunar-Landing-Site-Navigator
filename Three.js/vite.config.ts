import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const backendTarget = process.env.LUNAR_COMPASS_API_TARGET ?? "http://127.0.0.1:8000";

export default defineConfig({
  plugins: [react()],
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
