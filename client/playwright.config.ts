import { defineConfig, devices } from "@playwright/test";

/**
 * Visual-regression safety net for refactors that must not change the UI.
 * Builds a separate production bundle (.next-e2e) and serves it on :3100 so a
 * running `npm run dev` is never touched.
 *
 *   npm run test:visual            → compare against baseline (0 pixel diff)
 *   npm run test:visual:baseline   → (re)record baseline screenshots
 */
const PORT = 3100;

export default defineConfig({
  testDir: "./e2e",
  snapshotPathTemplate: "{testDir}/__screenshots__/{arg}{ext}",
  timeout: 90_000,
  fullyParallel: true,
  workers: 4,
  retries: 0,
  reporter: [["list"], ["html", { open: "never", outputFolder: "e2e/report" }]],
  outputDir: "e2e/results",
  expect: {
    timeout: 20_000,
    toHaveScreenshot: { maxDiffPixels: 0, animations: "disabled", caret: "hide", scale: "css" },
  },
  use: {
    baseURL: `http://localhost:${PORT}`,
    ...devices["Desktop Chrome"],
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    locale: "en-IN",
    timezoneId: "Asia/Kolkata",
  },
  webServer: {
    command: `npx next build && npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/login`,
    env: { NEXT_DIST_DIR: ".next-e2e" },
    timeout: 600_000,
    reuseExistingServer: false,
  },
});
