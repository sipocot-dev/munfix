import { defineConfig, devices } from "@playwright/test";

/*
 * End-to-end tests (e2e/). They need the app built and its services running; see docs/testing.md:
 *   npm run services:up && npm run build && npm run db:migrate && SEED_DEMO=true npm run db:seed && npm run test:e2e
 *
 * Projects: "setup" logs in once per role. "desktop" runs every test. "tablet" and "mobile" run the
 * @responsive tests (layout, navigation, map). With E2E_ALL_BROWSERS=1 (CI), Firefox and WebKit run the
 * @cross-browser tests. Tests that change data run on desktop only, so each runs once.
 */
const PORT = Number(process.env.E2E_PORT ?? 3200);
const BASE_URL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`;
const allBrowsers = process.env.E2E_ALL_BROWSERS === "1";

export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  forbidOnly: Boolean(process.env.CI),
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : [["list"]],
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
  },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    { name: "desktop", dependencies: ["setup"], use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
    { name: "tablet", dependencies: ["setup"], grep: /@responsive/, use: { ...devices["Desktop Chrome"], viewport: { width: 820, height: 1180 }, hasTouch: true } },
    { name: "mobile", dependencies: ["setup"], grep: /@responsive|@mobile/, use: { ...devices["Pixel 7"] } },
    // A short phone screen (iPhone SE size, Chromium): catches overlays covering content, which tall phones hide.
    { name: "mobile-small", dependencies: ["setup"], grep: /@responsive/, use: { ...devices["Pixel 7"], viewport: { width: 375, height: 667 } } },
    ...(allBrowsers
      ? [
          {
            name: "firefox",
            dependencies: ["setup"],
            grep: /@cross-browser/,
            use: {
              ...devices["Desktop Firefox"],
              viewport: { width: 1280, height: 800 },
              // Headless Firefox has no WebGL on a GPU-less runner. CI runs this project headed under xvfb
              // (E2E_HEADED_FIREFOX=1), where Mesa provides software OpenGL, so the map can draw.
              headless: process.env.E2E_HEADED_FIREFOX !== "1",
              launchOptions: { firefoxUserPrefs: { "webgl.force-enabled": true, "webgl.disabled": false } },
            },
          },
          { name: "webkit-mobile", dependencies: ["setup"], grep: /@cross-browser/, use: { ...devices["iPhone 14"] } },
        ]
      : []),
  ],
  webServer: {
    command: `npm run start -- -p ${PORT}`,
    url: `${BASE_URL}/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: "pipe",
  },
});
