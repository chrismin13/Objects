import { cloudflareTest } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vite-plus";

export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: "./wrangler.jsonc" },
      miniflare: {
        bindings: {
          WORKOS_API_KEY: "test_workos_api_key_not_a_real_credential",
          WORKOS_COOKIE_PASSWORD: "test-cookie-password-at-least-32-characters",
        },
      },
    }),
  ],
});
