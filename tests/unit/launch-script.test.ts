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
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const projectRoot = resolve(import.meta.dirname, "..", "..");
const startSource = join(projectRoot, "scripts", "Start-Harness.ps1");
const stopSource = join(projectRoot, "scripts", "Stop-Harness.ps1");
const temporaryRoots: string[] = [];
const ownedProcesses: ChildProcess[] = [];

type ScriptResult = Readonly<{
  status: number | null;
  stdout: string;
  stderr: string;
}>;

type LaunchEvent = Readonly<{
  event: string;
  arguments?: string[];
}>;

type EnvironmentPatch = Readonly<Record<string, string | undefined>>;

function createFixture(options: { nodeModules?: boolean; database?: boolean } = {}) {
  const root = mkdtempSync(join(tmpdir(), "harness-launcher-"));
  temporaryRoots.push(root);
  mkdirSync(join(root, "scripts"));
  if (existsSync(startSource)) copyFileSync(startSource, join(root, "scripts", "Start-Harness.ps1"));
  if (existsSync(stopSource)) copyFileSync(stopSource, join(root, "scripts", "Stop-Harness.ps1"));
  if (options.nodeModules) mkdirSync(join(root, "node_modules"));
  if (options.database) {
    mkdirSync(join(root, "data"));
    writeFileSync(join(root, "data", "harness.sqlite"), "existing database");
  }
  return root;
}

function runPowerShell(script: string, env: EnvironmentPatch = {}): ScriptResult {
  const escaped = script.replaceAll("'", "''");
  const result = spawnSync(
    "powershell.exe",
    [
      "-NoProfile",
      "-NonInteractive",
      "-ExecutionPolicy",
      "Bypass",
      "-Command",
      `[Console]::OutputEncoding = [Text.Encoding]::UTF8; & '${escaped}'`,
    ],
    {
      encoding: "utf8",
      env: { ...process.env, ...env },
      timeout: 15_000,
    },
  );
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

function runStart(root: string, env: EnvironmentPatch = {}) {
  const logPath = join(root, "launch-events.jsonl");
  const result = runPowerShell(join(root, "scripts", "Start-Harness.ps1"), {
    HARNESS_LAUNCHER_TEST: "1",
    HARNESS_LAUNCHER_TEST_LOG: logPath,
    HARNESS_LAUNCHER_TEST_NODE_MAJOR: "24",
    HARNESS_LAUNCHER_TEST_PID: "4242",
    HARNESS_LAUNCHER_TEST_START_TIME: "2026-08-13T04:05:06.123Z",
    ...env,
  });
  const events = existsSync(logPath)
    ? readFileSync(logPath, "utf8")
        .trim()
        .split(/\r?\n/)
        .filter(Boolean)
        .map((line) => JSON.parse(line) as LaunchEvent)
    : [];
  return { ...result, events };
}

function startOwnedSleeper() {
  const child = spawn(
    "powershell.exe",
    ["-NoProfile", "-NonInteractive", "-Command", "Start-Sleep -Seconds 60"],
    { stdio: "ignore" },
  );
  ownedProcesses.push(child);
  if (!child.pid) throw new Error("Could not start the test-owned sleeper process");
  return child;
}

function processStartTime(pid: number) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const result = spawnSync(
      "powershell.exe",
      [
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        `(Get-Process -Id ${pid} -ErrorAction Stop).StartTime.ToUniversalTime().ToString('O')`,
      ],
      { encoding: "utf8" },
    );
    if (result.status === 0 && result.stdout.trim()) return result.stdout.trim();
  }
  throw new Error(`Could not inspect test-owned PID ${pid}`);
}

function processExists(pid: number) {
  const result = spawnSync(
    "powershell.exe",
    ["-NoProfile", "-NonInteractive", "-Command", `Get-Process -Id ${pid} -ErrorAction Stop | Out-Null`],
    { stdio: "ignore" },
  );
  return result.status === 0;
}

function writeRuntime(root: string, pid: number, startTime: string) {
  const runtime = join(root, ".runtime");
  mkdirSync(runtime, { recursive: true });
  const serverFile = join(runtime, "server.json");
  writeFileSync(serverFile, JSON.stringify({ pid, startTime }), "utf8");
  return serverFile;
}

afterEach(() => {
  for (const child of ownedProcesses.splice(0)) {
    if (child.pid && processExists(child.pid)) child.kill();
  }
  for (const root of temporaryRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe("safe local launcher", () => {
  it("does no backup, migration, validation, build, or start when localhost port 3000 is occupied", () => {
    const root = createFixture({ nodeModules: true, database: true });
    const result = runStart(root, { HARNESS_LAUNCHER_TEST_PORT_OCCUPIED: "1" });

    expect(result.status).not.toBe(0);
    expect(result.events.map((event) => event.event)).toEqual(["port-check"]);
    expect(existsSync(join(root, ".runtime", "server.json"))).toBe(false);
  });

  it("backs up an existing database before migration and completes the remaining gates in order", () => {
    const root = createFixture({ nodeModules: true, database: true });
    const result = runStart(root);

    expect(result.status).toBe(0);
    expect(result.events.map((event) => event.event)).toEqual([
      "port-check",
      "db:backup",
      "db:migrate",
      "content:validate",
      "build",
      "start",
      "browser",
    ]);
    expect(existsSync(join(root, "backups", "harness-test-verified.sqlite"))).toBe(true);
  });

  it("reports the exact install instruction without running project commands when node_modules is absent", () => {
    const root = createFixture();
    const result = runStart(root);

    expect(result.status).not.toBe(0);
    expect(`${result.stdout}\n${result.stderr}`).toContain(
      "请先在项目目录运行 npm.cmd install。",
    );
    expect(result.events).toEqual([]);
  });

  it("rejects Node versions below 24 before any project side effect", () => {
    const root = createFixture({ nodeModules: true });
    const result = runStart(root, { HARNESS_LAUNCHER_TEST_NODE_MAJOR: "23" });

    expect(result.status).not.toBe(0);
    expect(`${result.stdout}\n${result.stderr}`).toContain("需要 Node.js 24 或更高版本。");
    expect(result.events).toEqual([]);
  });

  it("passes the exact localhost-only arguments to the child process", () => {
    const root = createFixture({ nodeModules: true });
    const result = runStart(root);
    const start = result.events.find((event) => event.event === "start");

    expect(start?.arguments).toEqual([
      "node_modules/next/dist/bin/next",
      "start",
      "--hostname",
      "127.0.0.1",
      "--port",
      "3000",
    ]);
  });

  it("writes the launched PID and an ISO UTC start time", () => {
    const root = createFixture({ nodeModules: true });
    const result = runStart(root);
    const record = JSON.parse(
      readFileSync(join(root, ".runtime", "server.json"), "utf8"),
    ) as { pid: number; startTime: string };

    expect(result.status).toBe(0);
    expect(record).toEqual({ pid: 4242, startTime: "2026-08-13T04:05:06.1230000Z" });
    expect(new Date(record.startTime).toISOString()).toBe("2026-08-13T04:05:06.123Z");
  });

  it("leaves no stale runtime state when starting the server fails", () => {
    const root = createFixture({ nodeModules: true });
    const result = runStart(root, { HARNESS_LAUNCHER_TEST_FAIL_COMMAND: "start" });

    expect(result.status).not.toBe(0);
    expect(existsSync(join(root, ".runtime", "server.json"))).toBe(false);
  });

  it("does not delete a runtime record it did not create", () => {
    const root = createFixture({ nodeModules: true });
    const serverFile = writeRuntime(root, 9911, "2026-08-13T04:05:06.123Z");
    const before = readFileSync(serverFile, "utf8");

    const result = runStart(root);

    expect(result.status).not.toBe(0);
    expect(readFileSync(serverFile, "utf8")).toBe(before);
  });

  it("contains no firewall mutation or wildcard bind as a supplementary static guard", () => {
    const source = readFileSync(startSource, "utf8");
    expect(source).not.toMatch(/New-NetFirewallRule|0\.0\.0\.0/);
  });
});

describe("identity-safe local stopper", () => {
  it("stops only a matching process within one second and then removes server.json", () => {
    const root = createFixture();
    const child = startOwnedSleeper();
    const actualStart = processStartTime(child.pid!);
    const withinOneSecond = new Date(Date.parse(actualStart) + 500).toISOString();
    const serverFile = writeRuntime(root, child.pid!, withinOneSecond);

    const result = runPowerShell(join(root, "scripts", "Stop-Harness.ps1"));

    expect(result.status).toBe(0);
    expect(processExists(child.pid!)).toBe(false);
    expect(existsSync(serverFile)).toBe(false);
  }, 15_000);

  it.each([
    ["mismatched identity", (root: string, pid: number, start: string) => writeRuntime(root, pid, new Date(Date.parse(start) + 10_000).toISOString())],
    ["corrupt state", (root: string) => {
      const runtime = join(root, ".runtime");
      mkdirSync(runtime);
      const path = join(runtime, "server.json");
      writeFileSync(path, "not json", "utf8");
      return path;
    }],
    ["unreadable state", (root: string) => {
      const runtime = join(root, ".runtime");
      mkdirSync(runtime);
      const path = join(runtime, "server.json");
      mkdirSync(path);
      return path;
    }],
  ])("fails closed for %s without stopping the recorded process", (_label, prepare) => {
    const root = createFixture();
    const child = startOwnedSleeper();
    const actualStart = processStartTime(child.pid!);
    const serverFile = prepare(root, child.pid!, actualStart);

    const result = runPowerShell(join(root, "scripts", "Stop-Harness.ps1"));

    expect(result.status).not.toBe(0);
    expect(processExists(child.pid!)).toBe(true);
    expect(existsSync(serverFile)).toBe(true);
  }, 15_000);

  it("fails closed when reading runtime state is denied", () => {
    const root = createFixture();
    const child = startOwnedSleeper();
    const serverFile = writeRuntime(root, child.pid!, processStartTime(child.pid!));

    const result = runPowerShell(join(root, "scripts", "Stop-Harness.ps1"), {
      HARNESS_STOPPER_TEST: "1",
      HARNESS_STOPPER_TEST_READ_DENIED: "1",
    });

    expect(result.status).not.toBe(0);
    expect(processExists(child.pid!)).toBe(true);
    expect(existsSync(serverFile)).toBe(true);
  }, 15_000);

  it("keeps server.json when stopping the matching process fails", () => {
    const root = createFixture();
    const child = startOwnedSleeper();
    const serverFile = writeRuntime(root, child.pid!, processStartTime(child.pid!));

    const result = runPowerShell(join(root, "scripts", "Stop-Harness.ps1"), {
      HARNESS_STOPPER_TEST: "1",
      HARNESS_STOPPER_TEST_FAIL_STOP: "1",
    });

    expect(result.status).not.toBe(0);
    expect(processExists(child.pid!)).toBe(true);
    expect(existsSync(serverFile)).toBe(true);
  }, 15_000);

  it("refuses a runtime file whose real path escapes the project", () => {
    const root = createFixture();
    const outside = mkdtempSync(join(tmpdir(), "harness-runtime-outside-"));
    temporaryRoots.push(outside);
    const child = startOwnedSleeper();
    writeFileSync(
      join(outside, "server.json"),
      JSON.stringify({ pid: child.pid, startTime: processStartTime(child.pid!) }),
      "utf8",
    );
    const junction = spawnSync(
      "powershell.exe",
      [
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        `New-Item -ItemType Junction -Path '${join(root, ".runtime").replaceAll("'", "''")}' -Target '${outside.replaceAll("'", "''")}' | Out-Null`,
      ],
      { encoding: "utf8" },
    );
    expect(junction.status).toBe(0);

    const result = runPowerShell(join(root, "scripts", "Stop-Harness.ps1"));

    expect(result.status).not.toBe(0);
    expect(processExists(child.pid!)).toBe(true);
    expect(existsSync(join(outside, "server.json"))).toBe(true);
  }, 15_000);
});
