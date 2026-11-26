import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "TNT_FOOD_");
  return { server: { proxy: { "/v1": { target: env.TNT_FOOD_API_URL || "http://127.0.0.1:8000" } } } };
});
