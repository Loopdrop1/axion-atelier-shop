// Browser-Tests (e2e/) gegen den Shop im Entwicklungsmodus und einen Supabase-Nachbau (e2e/fake-supabase.ts).
// Start: bun run test:e2e   (Browser: lokal installiertes Chromium, siehe PLAYWRIGHT_BROWSERS_PATH)
import { defineConfig, devices } from "@playwright/test";

const SHOP = "http://127.0.0.1:5173";
const FAKE = "http://127.0.0.1:54400";

export default defineConfig({
  testDir: "e2e",
  outputDir: ".local/e2e-results",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [["list"]],
  use: {
    baseURL: SHOP,
    locale: "de-CH",
    timezoneId: "Europe/Zurich",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 860 } },
    },
    { name: "handy", use: { ...devices["Pixel 7"] } },
  ],
  webServer: [
    {
      command: "bun e2e/fake-supabase.ts",
      url: `${FAKE}/__health`,
      reuseExistingServer: true,
      timeout: 20_000,
    },
    {
      command: "vite dev --port 5173 --host 127.0.0.1 --strictPort",
      url: SHOP,
      reuseExistingServer: true,
      timeout: 120_000,
      env: {
        VITE_SUPABASE_URL: FAKE,
        VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_e2e_fake",
      },
    },
  ],
});
