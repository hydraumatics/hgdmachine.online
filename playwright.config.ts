import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "tests",
  retries: process.env.CI ? 1 : 0,
  // In CI: failed tests show up as annotations and in the job summary (see tests/summary-reporter.mjs).
  reporter: process.env.CI ? [["list"], ["github"], ["html", { open: "never" }], ["./tests/summary-reporter.mjs"]] : "list",
  use: { baseURL: "http://localhost:4321", trace: "on-first-retry", reducedMotion: "reduce" },
  // Build with the built-in sample catalogue (PUBLIC_SHOPIFY_DOMAIN=mock); Shopify calls are intercepted in the tests.
  webServer: {
    command: "bun run build && bun run preview --port 4321",
    url: "http://localhost:4321",
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
    env: { PUBLIC_SHOPIFY_DOMAIN: "mock", PUBLIC_SHOPIFY_STOREFRONT_TOKEN: "mock" },
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
    { name: "mobile-safari", use: { ...devices["iPhone 14"] } },
    { name: "mobile-chrome", use: { ...devices["Pixel 7"] } },
  ],
});
