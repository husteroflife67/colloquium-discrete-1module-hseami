import { defineConfig } from "@playwright/test";
import config from "./playwright.config";
const prefix = process.env.VITE_BASE_PATH || "/colloquium-discrete-1module-hseami/";
export default defineConfig({
  ...config, testDir: "./tests-pages", workers: 1,
  use: { ...config.use, baseURL: `http://127.0.0.1:4173${prefix}` },
  webServer: { env: { VITE_BASE_PATH: prefix }, command: "npm run preview -- --port 4173 --strictPort", url: `http://127.0.0.1:4173${prefix}`, reuseExistingServer: false },
});
