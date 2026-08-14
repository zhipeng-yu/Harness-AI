import { defineConfig } from "@playwright/test";
import { existsSync, readdirSync, realpathSync } from "node:fs";
import { join, relative, resolve } from "node:path";

process.env.PLAYWRIGHT_BROWSERS_PATH = "0";

const PROJECT_DIRECTORY = realpathSync.native(process.cwd());
const PLAYWRIGHT_DIRECTORY = realpathSync.native(
  join(PROJECT_DIRECTORY, "node_modules", "playwright-core"),
);
const BROWSER_DIRECTORY = join(PLAYWRIGHT_DIRECTORY, ".local-browsers");

function resolveProjectChromium(): string {
  const executable = readdirSync(BROWSER_DIRECTORY)
    .filter((name) => name.startsWith("chromium-"))
    .sort()
    .reverse()
    .map((name) =>
      join(BROWSER_DIRECTORY, name, "chrome-win64", "chrome.exe"),
    )
    .find(existsSync);

  if (!executable) {
    throw new Error(
      "Project-local Chromium is missing. Run with PLAYWRIGHT_BROWSERS_PATH=0 before installing Chromium.",
    );
  }

  const executableRealPath = realpathSync.native(executable);
  const relativeExecutable = relative(PLAYWRIGHT_DIRECTORY, executableRealPath);
  if (
    relativeExecutable.startsWith("..") ||
    resolve(PLAYWRIGHT_DIRECTORY, relativeExecutable) !== executableRealPath
  ) {
    throw new Error("Refusing to use Chromium outside project node_modules.");
  }

  return executableRealPath;
}

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  globalSetup: "./scripts/seed-e2e-content.ts",
  reporter: "list",
  outputDir: "test-results",
  use: {
    baseURL: "http://127.0.0.1:3000",
    browserName: "chromium",
    headless: true,
    launchOptions: {
      executablePath: resolveProjectChromium(),
    },
    trace: "retain-on-failure",
    viewport: { width: 1440, height: 900 },
  },
  webServer: {
    command: "npm.cmd run dev",
    url: "http://127.0.0.1:3000",
    env: {
      HARNESS_DB_PATH: "data/e2e.sqlite",
      HARNESS_CONTENT_FIXTURE: "published-chapter",
      HARNESS_E2E: "1",
      NODE_OPTIONS: "--disable-warning=ExperimentalWarning",
    },
    reuseExistingServer: false,
  },
});
