import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { delimiter, join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const projectRoot = resolve(import.meta.dirname, "..", "..");
const testTempRoot = join(projectRoot, ".tools", "launcher-tests");
const startSource = join(projectRoot, "scripts", "Start-Harness.ps1");
const stopSource = join(projectRoot, "scripts", "Stop-Harness.ps1");
const temporaryRoots: string[] = [];
const ownedProcesses: ChildProcess[] = [];

type ScriptResult = Readonly<{
  status: number | null;
  stdout: string;
  stderr: string;
}>;

type FixtureOptions = Readonly<{
  database?: boolean;
  mode?: "ready" | "delayed" | "exit" | "never";
  nodeModules?: boolean;
}>;

type EnvironmentPatch = Readonly<Record<string, string | undefined>>;

function createFixture({
  database = false,
  mode = "ready",
  nodeModules = true,
}: FixtureOptions = {}) {
  mkdirSync(testTempRoot, { recursive: true });
  const root = mkdtempSync(join(testTempRoot, "project-"));
  temporaryRoots.push(root);
  mkdirSync(join(root, "scripts"));
  mkdirSync(join(root, "bin"));
  copyFileSync(startSource, join(root, "scripts", "Start-Harness.ps1"));
  copyFileSync(stopSource, join(root, "scripts", "Stop-Harness.ps1"));
  const commandLog = join(root, "npm-commands.log");
  writeFileSync(
    join(root, "bin", "npm.cmd"),
    [
      "@echo off",
      `echo %1 %2>>\"${commandLog}\"`,
      "if \"%HARNESS_FIXTURE_FAIL_COMMAND%\"==\"%2\" exit /b 1",
      "exit /b 0",
      "",
    ].join("\r\n"),
    "utf8",
  );
  if (nodeModules) {
    const nextDir = join(root, "node_modules", "next", "dist", "bin");
    mkdirSync(nextDir, { recursive: true });
    writeFileSync(
      join(nextDir, "next"),
      [
        'const fs = require("node:fs");',
        'const http = require("node:http");',
        `fs.writeFileSync(${JSON.stringify(join(root, "child-arguments.json"))}, JSON.stringify(process.argv.slice(2)));`,
        `const mode = ${JSON.stringify(mode)};`,
        'if (mode === "exit") process.exit(17);',
        'const server = http.createServer((_request, response) => { response.statusCode = 200; response.end("ready"); });',
        'const listen = () => server.listen(3000, "127.0.0.1");',
        'if (mode === "delayed") setTimeout(listen, 700);',
        'else if (mode === "ready") listen();',
        'else setInterval(() => {}, 1000);',
        'process.on("SIGTERM", () => server.close(() => process.exit(0)));',
        "",
      ].join("\n"),
      "utf8",
    );
  }
  if (database) {
    mkdirSync(join(root, "data"));
    writeFileSync(join(root, "data", "harness.sqlite"), "existing database");
  }
  return { root, commandLog };
}

function powerShellResult(
  command: string[],
  env: EnvironmentPatch = {},
  timeout = 45_000,
): ScriptResult {
  const result = spawnSync("powershell.exe", command, {
    encoding: "utf8",
    env: { ...process.env, ...env },
    timeout,
  });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

function runScript(
  path: string,
  args: string[] = [],
  env: EnvironmentPatch = {},
  timeout?: number,
) {
  return powerShellResult(
    ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", path, ...args],
    env,
    timeout,
  );
}

function fixtureEnvironment(root: string, patch: EnvironmentPatch = {}) {
  return {
    PATH: `${join(root, "bin")}${delimiter}${process.env.PATH ?? ""}`,
    ...patch,
  };
}

function runStart(
  root: string,
  options: Readonly<{ env?: EnvironmentPatch; timeoutSeconds?: number }> = {},
) {
  return runScript(
    join(root, "scripts", "Start-Harness.ps1"),
    ["-SkipBrowser", "-ReadinessTimeoutSeconds", String(options.timeoutSeconds ?? 4)],
    fixtureEnvironment(root, options.env),
  );
}

function commandEvents(path: string) {
  return existsSync(path)
    ? readFileSync(path, "utf8").trim().split(/\r?\n/).filter(Boolean)
    : [];
}

function processExists(pid: number) {
  return spawnSync(
    "powershell.exe",
    ["-NoProfile", "-NonInteractive", "-Command", `Get-Process -Id ${pid} -ErrorAction Stop | Out-Null`],
    { stdio: "ignore" },
  ).status === 0;
}

function processStartTime(pid: number) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const result = powerShellResult([
      "-NoProfile",
      "-NonInteractive",
      "-Command",
      `(Get-Process -Id ${pid} -ErrorAction Stop).StartTime.ToUniversalTime().ToString('O')`,
    ]);
    if (result.status === 0 && result.stdout.trim()) return result.stdout.trim();
  }
  throw new Error(`Could not inspect test-owned PID ${pid}`);
}

function runtimeRecord(root: string) {
  return JSON.parse(readFileSync(join(root, ".runtime", "server.json"), "utf8")) as {
    pid: number;
    startTime: string;
  };
}

function writeRuntime(root: string, pid: number, startTime: string) {
  const runtime = join(root, ".runtime");
  mkdirSync(runtime, { recursive: true });
  const serverFile = join(runtime, "server.json");
  writeFileSync(serverFile, JSON.stringify({ pid, startTime }), "utf8");
  return serverFile;
}

function startOwnedSleeper() {
  const child = spawn(
    "powershell.exe",
    ["-NoProfile", "-NonInteractive", "-Command", "Start-Sleep -Seconds 60"],
    { stdio: "ignore" },
  );
  if (!child.pid) throw new Error("Could not start test-owned sleeper");
  ownedProcesses.push(child);
  return child;
}

function escapePowerShell(path: string) {
  return path.replaceAll("'", "''");
}

function runDotSourcedDriver(root: string, body: string, env: EnvironmentPatch = {}) {
  const driver = join(root, "driver.ps1");
  writeFileSync(
    driver,
    `. '${escapePowerShell(join(root, "scripts", body.includes("Invoke-HarnessStart") ? "Start-Harness.ps1" : "Stop-Harness.ps1"))}'\n${body}\n`,
    "utf8",
  );
  return runScript(driver, [], fixtureEnvironment(root, env));
}

afterEach(() => {
  for (const root of temporaryRoots) {
    const serverFile = join(root, ".runtime", "server.json");
    if (existsSync(serverFile) && existsSync(join(root, "child-arguments.json"))) {
      const record = runtimeRecord(root);
      if (processExists(record.pid)) {
        runScript(join(root, "scripts", "Stop-Harness.ps1"));
      }
    }
  }
  for (const child of ownedProcesses.splice(0)) {
    if (child.pid && processExists(child.pid)) child.kill();
  }
  for (const root of temporaryRoots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("safe local launcher", () => {
  it("does not let an inherited HARNESS_LAUNCHER_TEST environment variable bypass production gates", () => {
    const { root, commandLog } = createFixture({ nodeModules: false });
    const result = runStart(root, {
      env: {
        HARNESS_LAUNCHER_TEST: "1",
        HARNESS_LAUNCHER_TEST_NODE_MAJOR: "24",
        HARNESS_LAUNCHER_TEST_PID: "4242",
      },
    });

    expect(result.status).not.toBe(0);
    expect(`${result.stdout}\n${result.stderr}`).toMatch(/npm\.cmd\s+i\s*nstall/);
    expect(commandEvents(commandLog)).toEqual([]);
    expect(existsSync(join(root, ".runtime", "server.json"))).toBe(false);
  }, 20_000);

  it("detects a wildcard listener before backup or any other project command", async () => {
    const { root, commandLog } = createFixture({ database: true });
    const listenerScript = join(root, "wildcard-listener.js");
    writeFileSync(
      listenerScript,
      'require("node:http").createServer((_q,r)=>r.end("occupied")).listen(3000,"0.0.0.0",()=>console.log("ready"));',
      "utf8",
    );
    const listener = spawn(process.execPath, [listenerScript], { stdio: ["ignore", "pipe", "ignore"] });
    ownedProcesses.push(listener);
    await new Promise<void>((resolveReady, reject) => {
      listener.stdout?.setEncoding("utf8").once("data", () => resolveReady());
      listener.once("exit", (code) => reject(new Error(`listener exited ${code}`)));
    });

    const result = runStart(root);

    expect(result.status).not.toBe(0);
    expect(commandEvents(commandLog)).toEqual([]);
    expect(existsSync(join(root, ".runtime", "server.json"))).toBe(false);
  }, 20_000);

  it("backs up an existing database before migration, validation, and build", () => {
    const { root, commandLog } = createFixture({ database: true });

    const result = runStart(root);

    expect(result.status).toBe(0);
    expect(commandEvents(commandLog)).toEqual([
      "run db:backup",
      "run db:migrate",
      "run content:validate",
      "run build",
    ]);
  });

  it("rejects Node below 24 before project commands", () => {
    const { root, commandLog } = createFixture();
    writeFileSync(join(root, "bin", "node.cmd"), "@echo off\r\necho 23\r\n", "utf8");

    const result = runStart(root);

    expect(result.status).not.toBe(0);
    expect(`${result.stdout}\n${result.stderr}`).toContain("Node.js 24");
    expect(commandEvents(commandLog)).toEqual([]);
  });

  it("starts the real child with exact localhost arguments and writes its real identity after HTTP readiness", async () => {
    const { root } = createFixture();

    const result = runStart(root);
    const record = runtimeRecord(root);
    const response = await fetch("http://127.0.0.1:3000");

    expect(result.status).toBe(0);
    expect(JSON.parse(readFileSync(join(root, "child-arguments.json"), "utf8"))).toEqual([
      "start",
      "--hostname",
      "127.0.0.1",
      "--port",
      "3000",
    ]);
    expect(response.status).toBe(200);
    expect(processExists(record.pid)).toBe(true);
    expect(Math.abs(Date.parse(processStartTime(record.pid)) - Date.parse(record.startTime))).toBeLessThanOrEqual(1_000);
  }, 20_000);

  it("waits for delayed HTTP readiness before returning and writing runtime state", () => {
    const { root } = createFixture({ mode: "delayed" });
    const startedAt = Date.now();

    const result = runStart(root);

    expect(result.status).toBe(0);
    expect(Date.now() - startedAt).toBeGreaterThanOrEqual(600);
    expect(existsSync(join(root, ".runtime", "server.json"))).toBe(true);
  }, 20_000);

  it.each([
    ["exits before readiness", "exit" as const, 4],
    ["never becomes ready", "never" as const, 1],
  ])("cleans up without stale state when the child %s", (_label, mode, timeoutSeconds) => {
    const { root } = createFixture({ mode });

    const result = runStart(root, { timeoutSeconds });

    expect(result.status).not.toBe(0);
    expect(existsSync(join(root, ".runtime", "server.json"))).toBe(false);
    const childArgs = readFileSync(join(root, "child-arguments.json"), "utf8");
    expect(childArgs).toContain("127.0.0.1");
  });

  it("preserves a recoverable real identity when browser open and cleanup both fail", () => {
    const { root } = createFixture();
    const result = runDotSourcedDriver(
      root,
      [
        "$script:fake = [pscustomobject]@{ Id = 8123; StartTime = [datetime]'2026-08-13T04:05:06Z'; HasExited = $false }",
        "$script:fake | Add-Member ScriptMethod Refresh {}",
        "function Get-Command { [pscustomobject]@{ Source = 'node.exe' } }",
        "function Get-NetTCPConnection { $null }",
        "function Invoke-WebRequest { [pscustomobject]@{ StatusCode = 200 } }",
        "function Start-Process { param($FilePath) if ($FilePath -like 'http*') { throw 'browser failed' }; $script:fake }",
        "function Stop-Process { throw 'stop failed' }",
        `try { Invoke-HarnessStart -ProjectRoot '${escapePowerShell(root)}' -ReadinessTimeoutSeconds 1 } catch { Write-Error $_.Exception.Message; exit 1 }`,
      ].join("\n"),
    );

    expect(result.status).not.toBe(0);
    expect(runtimeRecord(root)).toEqual({ pid: 8123, startTime: "2026-08-13T04:05:06.0000000Z" });
    expect(`${result.stdout}\n${result.stderr}`).toContain("Stop-Harness");
  });

  it("contains no firewall mutation or wildcard bind", () => {
    const source = readFileSync(startSource, "utf8");
    expect(source).not.toMatch(/New-NetFirewallRule|0\.0\.0\.0/);
  });
});

describe("identity-safe local stopper", () => {
  it("stops only a matching process object and removes state after confirmed exit", () => {
    const { root } = createFixture();
    const child = startOwnedSleeper();
    const serverFile = writeRuntime(root, child.pid!, new Date(Date.parse(processStartTime(child.pid!)) + 500).toISOString());

    const result = runScript(join(root, "scripts", "Stop-Harness.ps1"));

    expect(result.status).toBe(0);
    expect(processExists(child.pid!)).toBe(false);
    expect(existsSync(serverFile)).toBe(false);
  }, 20_000);

  it("rechecks the same process object immediately before stop and refuses a replaced identity", () => {
    const { root } = createFixture();
    const serverFile = writeRuntime(root, 8123, "2026-08-13T04:05:06Z");
    const stopMarker = join(root, "stop-called");
    const result = runDotSourcedDriver(
      root,
      [
        "$script:fake = [pscustomobject]@{ Id = 8123; StartTime = [datetime]'2026-08-13T04:05:06Z'; HasExited = $false }",
        "$script:fake | Add-Member ScriptMethod Refresh { $this.StartTime = [datetime]'2026-08-13T04:05:20Z' }",
        "function Get-Process { $script:fake }",
        `function Stop-Process { Set-Content -LiteralPath '${escapePowerShell(stopMarker)}' -Value called }`,
        `try { Invoke-HarnessStop -ProjectRoot '${escapePowerShell(root)}' } catch { Write-Error $_.Exception.Message; exit 1 }`,
      ].join("\n"),
    );

    expect(result.status).not.toBe(0);
    expect(existsSync(stopMarker)).toBe(false);
    expect(existsSync(serverFile)).toBe(true);
  });

  it.each([
    ["mismatched identity", (root: string, pid: number, start: string) => writeRuntime(root, pid, new Date(Date.parse(start) + 10_000).toISOString())],
    ["corrupt state", (root: string) => { const path = writeRuntime(root, 1, new Date().toISOString()); writeFileSync(path, "not json"); return path; }],
    ["unreadable state", (root: string) => { const runtime = join(root, ".runtime"); mkdirSync(runtime); const path = join(runtime, "server.json"); mkdirSync(path); return path; }],
  ])("fails closed for %s", (_label, prepare) => {
    const { root } = createFixture();
    const child = startOwnedSleeper();
    const serverFile = prepare(root, child.pid!, processStartTime(child.pid!));

    const result = runScript(join(root, "scripts", "Stop-Harness.ps1"));

    expect(result.status).not.toBe(0);
    expect(processExists(child.pid!)).toBe(true);
    expect(existsSync(serverFile)).toBe(true);
  }, 20_000);

  it("fails closed on a denied state read without an environment-variable bypass", () => {
    const { root } = createFixture();
    const child = startOwnedSleeper();
    const serverFile = writeRuntime(root, child.pid!, processStartTime(child.pid!));
    const result = runDotSourcedDriver(
      root,
      [
        "function Get-Content { throw [UnauthorizedAccessException]::new('denied') }",
        `try { Invoke-HarnessStop -ProjectRoot '${escapePowerShell(root)}' } catch { Write-Error $_.Exception.Message; exit 1 }`,
      ].join("\n"),
    );

    expect(result.status).not.toBe(0);
    expect(processExists(child.pid!)).toBe(true);
    expect(existsSync(serverFile)).toBe(true);
  }, 20_000);

  it("keeps server.json when stopping the matching process fails", () => {
    const { root } = createFixture();
    const child = startOwnedSleeper();
    const serverFile = writeRuntime(root, child.pid!, processStartTime(child.pid!));
    const result = runDotSourcedDriver(
      root,
      [
        "function Stop-Process { throw 'stop failed' }",
        `try { Invoke-HarnessStop -ProjectRoot '${escapePowerShell(root)}' } catch { Write-Error $_.Exception.Message; exit 1 }`,
      ].join("\n"),
    );

    expect(result.status).not.toBe(0);
    expect(processExists(child.pid!)).toBe(true);
    expect(existsSync(serverFile)).toBe(true);
  }, 20_000);

  it("refuses a runtime junction that resolves outside the project", () => {
    const { root } = createFixture();
    const outside = mkdtempSync(join(testTempRoot, "outside-"));
    temporaryRoots.push(outside);
    const child = startOwnedSleeper();
    writeFileSync(join(outside, "server.json"), JSON.stringify({ pid: child.pid, startTime: processStartTime(child.pid!) }));
    const junction = powerShellResult([
      "-NoProfile",
      "-NonInteractive",
      "-Command",
      `New-Item -ItemType Junction -Path '${escapePowerShell(join(root, ".runtime"))}' -Target '${escapePowerShell(outside)}' | Out-Null`,
    ]);
    expect(junction.status).toBe(0);

    const result = runScript(join(root, "scripts", "Stop-Harness.ps1"));

    expect(result.status).not.toBe(0);
    expect(processExists(child.pid!)).toBe(true);
    expect(existsSync(join(outside, "server.json"))).toBe(true);
  }, 20_000);
});
