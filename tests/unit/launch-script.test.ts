import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = resolve(import.meta.dirname, "..", "..");
const startPath = join(projectRoot, "scripts", "Start-Harness.ps1");
const stopPath = join(projectRoot, "scripts", "Stop-Harness.ps1");

describe("local launcher", () => {
  it.each([startPath, stopPath])("has valid PowerShell syntax: %s", (path) => {
    const command = `[scriptblock]::Create([IO.File]::ReadAllText('${path.replaceAll("'", "''")}')) | Out-Null`;
    const result = spawnSync("powershell.exe", ["-NoProfile", "-Command", command]);
    expect(result.status).toBe(0);
  });

  it("binds the website to localhost", () => {
    const source = readFileSync(startPath, "utf8");
    expect(source).toContain("'127.0.0.1'");
    expect(source).not.toContain("'0.0.0.0'");
  });
});
