import { defineConfig } from "@playwright/test";

const specPatterns = ["lab-02/**/*.spec.ts", "lab-03/**/*.spec.ts"];

export default defineConfig({
  testDir: ".",
  timeout: 30000,
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: "http://localhost:5173",
    trace: "retain-on-failure",
    video: "retain-on-failure",
  },
  webServer: [
    {
      command: "npm run dev",
      cwd: "../server",
      url: "http://localhost:3000/api/health",
      reuseExistingServer: true,
      timeout: 30000,
    },
    {
      command: "npm run dev",
      cwd: "../client",
      url: "http://localhost:5173",
      reuseExistingServer: true,
      timeout: 30000,
    },
  ],
  projects: [
    // Chained so each reset only starts once the PREVIOUS project has fully
    // finished, forcing a strict sequence: reset -> desktop -> reset -> tablet
    // -> reset -> mobile. Without the extra "depends on the previous project"
    // link, Playwright is free to run all three resets back-to-back at the
    // very start (since they have no dependencies on each other), which
    // defeats the point entirely.
    { name: "reset-desktop", testMatch: /reset\.setup\.ts/ },
    {
      name: "desktop",
      dependencies: ["reset-desktop"],
      testMatch: specPatterns,
      use: { viewport: { width: 1280, height: 800 } },
    },

    { name: "reset-tablet", testMatch: /reset\.setup\.ts/, dependencies: ["desktop"] },
    {
      name: "tablet",
      dependencies: ["reset-tablet"],
      testMatch: specPatterns,
      use: { viewport: { width: 834, height: 1112 } },
    },

    { name: "reset-mobile", testMatch: /reset\.setup\.ts/, dependencies: ["tablet"] },
    {
      name: "mobile",
      dependencies: ["reset-mobile"],
      testMatch: specPatterns,
      use: { viewport: { width: 375, height: 812 } },
    },
  ],
});