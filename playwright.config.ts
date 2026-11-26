import { defineConfig } from "@playwright/test";

const baseURL = "http://127.0.0.1:15173";
export default defineConfig({
  testDir: "./tests/e2e",
  use: { baseURL, viewport: { width: 375, height: 800 } },
  webServer: {
    command: "npm run dev -- --port 15173",
    url: baseURL,
    env: { TNT_FOOD_API_URL: "http://127.0.0.1:18000" },
    reuseExistingServer: false,
  },
});
