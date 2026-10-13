import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright E2E — spins up the production build (npm run build && npm run
 * start) so the suite exercises the same standalone server that ships, with
 * CSP in its production form. Run: npm run test:e2e
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  outputDir: "test-results",
  timeout: 30_000,
  use: {
    baseURL: "http://127.0.0.1:3100",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      // iPhone 13 viewport/UA via Chromium — WebKit is not installable in the
      // target sandbox; the touch viewport is what this suite pins.
      name: "mobile-navigation",
      testMatch: /mobile-navigation\.spec\.ts/,
      use: {
        ...devices["iPhone 13"],
        browserName: "chromium",
      },
    },
    {
      name: "desktop-chromium",
      testIgnore: /mobile-navigation\.spec\.ts/,
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
  ],
  webServer: {
    // The standalone server reads PORT; the health route doubles as the
    // readiness probe (it round-trips the database). S14-4: a fresh start
    // first restores every product's stock to its seed value — e2e checkouts
    // are traffic that permanently drains the traffic-owned demo stock (the
    // seed policy never refreshes it), which eventually broke the pins that
    // assume the seeded "In Stock" state. A reused healthy server keeps its
    // (already restored) state.
    command: "npx tsx scripts/restore-demo-stock.ts && PORT=3100 npm run start",
    url: "http://127.0.0.1:3100/api/health",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
