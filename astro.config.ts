import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, envField } from "astro/config";

export default defineConfig({
  site: "https://www.hydraumatics.zm",
  output: "static",
  trailingSlash: "never",
  integrations: [sitemap()],
  image: { domains: ["cdn.shopify.com"] },
  vite: { plugins: [tailwindcss()] },
  // Typed, validated environment. The Storefront token is designed to be public (read-only).
  env: {
    schema: {
      PUBLIC_SHOPIFY_DOMAIN: envField.string({ context: "client", access: "public", optional: true }),
      PUBLIC_SHOPIFY_STOREFRONT_TOKEN: envField.string({ context: "client", access: "public", optional: true }),
      PUBLIC_SHOPIFY_API_VERSION: envField.string({ context: "client", access: "public", default: "2026-07" }),
    },
  },
});
