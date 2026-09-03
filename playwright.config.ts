import { defineConfig, devices } from "@playwright/test";
import path from "node:path";

const runId = process.env.PLAYWRIGHT_RUN_ID || "local";
const baseURL = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3100";
const evidenceRoot = path.join("output", "playwright", "runs", runId);

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  expect: {
    timeout: 7_000
  },
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  outputDir: path.join(evidenceRoot, "test-results"),
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: path.join(evidenceRoot, "html-report") }],
    ["json", { outputFile: path.join(evidenceRoot, "results.json") }]
  ],
  use: {
    ...devices["Desktop Chrome"],
    baseURL,
    channel: process.env.PLAYWRIGHT_CHANNEL || "chrome",
    trace: "on",
    screenshot: "only-on-failure",
    video: "off"
  },
  webServer: {
    command: "npm run dev -- --hostname 127.0.0.1 --port 3100",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000
  }
});
