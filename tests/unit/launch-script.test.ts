import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = resolve(import.meta.dirname, "..", "..");
const startPath = join(projectRoot, "scripts", "Start-Harness.ps1");
const stopPath = join(projectRoot, "scripts", "Stop-Harness.ps1");

function runLauncher(script: string, mocks: string, record?: object) {
  const root = mkdtempSync(join(tmpdir(), "harness-launcher-"));
  try {
    mkdirSync(join(root, "scripts"));
    mkdirSync(join(root, "node_modules"));
    mkdirSync(join(root, ".runtime"));
    const path = join(root, "scripts", script);
    cpSync(join(projectRoot, "scripts", script), path);
    const recordPath = join(root, ".runtime", "server.json");
    if (record) writeFileSync(recordPath, JSON.stringify(record));
    const result = spawnSync("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", `
      $ErrorActionPreference = 'Stop'
      function Start-Process { throw 'Unexpected process or browser launch' }
      function taskkill.exe { throw 'Unexpected process termination' }
      ${mocks}
      & '${path.replaceAll("'", "''")}' ${script.startsWith("Start") ? "-SkipBrowser -ReadinessTimeoutSeconds 1" : ""}
    `], { encoding: "utf8" });
    return { ...result, record: existsSync(recordPath) ? readFileSync(recordPath, "utf8").replace(/^\uFEFF/, "") : "null" };
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

const existingServer = `
  function Get-NetTCPConnection {
    [pscustomobject]@{ LocalAddress = '127.0.0.1'; LocalPort = 3001; OwningProcess = 42 }
  }
  function Get-CimInstance {
    param($ClassName, $Filter)
    if ($Filter -eq 'ProcessId = 42') {
      [pscustomobject]@{
        Name = 'node.exe'; ProcessId = 42; ParentProcessId = 41
        CreationDate = [datetime]'2026-09-09T01:00:01Z'
        CommandLine = 'node.exe "' + (Join-Path $projectRoot 'node_modules\\next\\dist\\server\\lib\\start-server.js') + '"'
      }
    } else {
      [pscustomobject]@{
        Name = 'node.exe'; ProcessId = 41
        CreationDate = [datetime]'2026-09-09T01:00:00Z'
        CommandLine = 'node.exe node_modules/next/dist/bin/next dev --hostname 127.0.0.1 --port 3001'
      }
    }
  }
  function Get-Process {
    param($Id)
    [pscustomobject]@{ Id = $Id; StartTime = [datetime]'2026-09-09T01:00:00Z' }
  }
`;

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

  it.each([undefined, { pid: 41, startTime: "2026-09-09T01:00:00Z" }])(
    "reuses the project server with or without a record: %j", (record) => {
      const result = runLauncher("Start-Harness.ps1", existingServer, record);
      expect(result.status, result.stdout + result.stderr).toBe(0);
      expect(result.stdout).toContain("already running");
      expect(JSON.parse(result.record).pid).toBe(41);
      expect(new Date(JSON.parse(result.record).startTime).toISOString()).toBe("2026-09-09T01:00:00.000Z");
    },
  );

  it("preserves the record and leaves a foreign port owner alone", () => {
    const record = { pid: 99, startTime: "2026-09-09T01:00:00Z" };
    const result = runLauncher("Start-Harness.ps1", existingServer + `
      function Get-CimInstance { [pscustomobject]@{ Name = 'other.exe'; CommandLine = 'other' } }
    `, record);
    expect(result.status).toBe(1);
    expect(result.stdout).toContain("another application (PID 42)");
    expect(JSON.parse(result.record)).toEqual(record);
  });

  it("does not stop a reused PID or remove its record", () => {
    const record = { pid: 41, startTime: "2026-09-08T01:00:00Z" };
    const result = runLauncher("Stop-Harness.ps1", existingServer, record);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("PID now belongs to another");
    expect(JSON.parse(result.record)).toEqual(record);
  });

  it("stops the verified process tree and removes its record", () => {
    const result = runLauncher("Stop-Harness.ps1", existingServer + `
      function Get-Process {
        $fake = [pscustomobject]@{ Id = 41; StartTime = [datetime]'2026-09-09T01:00:00Z' }
        $fake | Add-Member ScriptMethod WaitForExit { param($timeout) return $true }
        return $fake
      }
      function taskkill.exe {
        if (($args -join ' ') -ne '/PID 41 /T /F') { throw 'Wrong process tree' }
        Write-Host 'Verified tree stopped'
        $global:LASTEXITCODE = 0
      }
    `, { pid: 41, startTime: "2026-09-09T01:00:00Z" });
    expect(result.status, result.stdout + result.stderr).toBe(0);
    expect(result.stdout).toContain("Verified tree stopped");
    expect(JSON.parse(result.record)).toBeNull();
  });

  it("starts normally when only a stale record remains", () => {
    const result = runLauncher("Start-Harness.ps1", `
      function Get-NetTCPConnection { }
      function Start-Process {
        $fake = [pscustomobject]@{ Id = 41; StartTime = [datetime]'2026-09-09T01:00:00Z'; HasExited = $false }
        $fake | Add-Member ScriptMethod Refresh { }
        return $fake
      }
      function Invoke-WebRequest { [pscustomobject]@{ StatusCode = 200 } }
    `, { pid: 99, startTime: "2026-09-08T01:00:00Z" });
    expect(result.status, result.stdout + result.stderr).toBe(0);
    expect(JSON.parse(result.record).pid).toBe(41);
  });
});
