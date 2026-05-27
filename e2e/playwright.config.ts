import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright configuration for Rust-RED end-to-end tests.
 *
 * Prerequisites:
 *   - Rust-RED server running at http://127.0.0.1:1888
 *     (cargo run --features web from the project root)
 *
 * Run:
 *   cd e2e && npm install && npx playwright install chromium
 *   npm test                     # all tests
 *   npm run test:api             # API-only tests (fast, no browser)
 *   npm run test:editor          # editor UI tests
 *   npm run test:flows           # flow CRUD tests
 */
export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  timeout: 30_000,
  expect: { timeout: 10_000 },
  report: [["html", { open: "never" }], ["list"]],

  use: {
    baseURL: "http://127.0.0.1:1888",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "off",
    actionTimeout: 15_000,
    navigationTimeout: 20_000,
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
