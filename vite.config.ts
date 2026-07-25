import { defineConfig } from "vite-plus";
import preact from "@preact/preset-vite";
import { cloudflare } from "@cloudflare/vite-plugin";

export default defineConfig({
  plugins: [preact(), cloudflare()],
  fmt: {},
  lint: {
    jsPlugins: [{ name: "vite-plus", specifier: "vite-plus/oxlint-plugin" }],
    rules: { "vite-plus/prefer-vite-plus-imports": "error" },
    options: { typeAware: true, typeCheck: true },
    // Legacy Lakebed capsule files remain on disk until Phase 4 replaces them;
    // they do not resolve outside the Lakebed toolchain.
    ignorePatterns: ["client/**", "server/**", "scripts/**"],
  },
});
