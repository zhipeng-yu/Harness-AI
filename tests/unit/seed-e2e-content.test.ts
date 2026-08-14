import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { assertSafeE2eEnvironment } from "@/scripts/seed-e2e-content";

function createProjectLocalTempDirectory(): string {
  const artifactsDirectory = resolve("artifacts");
  mkdirSync(artifactsDirectory, { recursive: true });
  const temporary = mkdtempSync(join(artifactsDirectory, "seed-safety-"));
  const relativeTemporary = relative(artifactsDirectory, temporary);
  if (
    relativeTemporary === "" ||
    relativeTemporary === ".." ||
    relativeTemporary.startsWith(`..${sep}`)
  ) {
    throw new Error(`Temporary directory escaped project artifacts: ${temporary}`);
  }
  return temporary;
}

test("rejects an E2E seed launched from a foreign working directory", () => {
  const temporary = createProjectLocalTempDirectory();
  try {
    expect(() =>
      assertSafeE2eEnvironment(
        resolve("playwright.config.ts"),
        temporary,
      ),
    ).toThrow("project root");
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
});

test("rejects a project data directory that is a junction or reparse point", () => {
  const temporary = createProjectLocalTempDirectory();
  const projectDirectory = join(temporary, "project");
  const outsideDataDirectory = join(temporary, "outside-data");
  const configFile = join(projectDirectory, "playwright.config.ts");
  const dataDirectory = join(projectDirectory, "data");

  mkdirSync(projectDirectory);
  mkdirSync(outsideDataDirectory);
  writeFileSync(configFile, "export default {};\n", "utf8");
  symlinkSync(
    outsideDataDirectory,
    dataDirectory,
    process.platform === "win32" ? "junction" : "dir",
  );

  try {
    expect(() =>
      assertSafeE2eEnvironment(configFile, projectDirectory),
    ).toThrow("data directory");
  } finally {
    unlinkSync(dataDirectory);
    rmSync(temporary, { recursive: true, force: true });
  }
});
