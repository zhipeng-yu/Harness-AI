import { lstatSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { SERVER_STATE_PATH } from "@/src/lib/paths";

export type ProcessIdentity =
  | { status: "alive"; startTime: string }
  | { status: "dead" };

export const backupRuntimeOps = {
  statePath() {
    return SERVER_STATE_PATH;
  },
  lstatState(path: string) {
    return lstatSync(path);
  },
  readState(path: string) {
    return readFileSync(path, "utf8");
  },
  inspectProcess(pid: number): ProcessIdentity {
    if (process.platform !== "win32") {
      throw new Error("Process identity inspection is only supported on Windows");
    }
    const script = [
      "param([int]$RequestedPid)",
      "try {",
      "  $process = Get-Process -Id $RequestedPid -ErrorAction Stop",
      "  @{ status = 'alive'; startTime = $process.StartTime.ToUniversalTime().ToString('O') } | ConvertTo-Json -Compress",
      "} catch [Microsoft.PowerShell.Commands.ProcessCommandException] {",
      "  @{ status = 'dead' } | ConvertTo-Json -Compress",
      "} catch {",
      "  Write-Error $_",
      "  exit 1",
      "}",
    ].join("\n");
    const result = spawnSync(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-Command", `& { ${script} } ${pid}`],
      { encoding: "utf8", windowsHide: true },
    );
    if (result.status !== 0 || result.error) {
      throw new Error(
        `Could not inspect website process ${pid}: ${result.error?.message ?? result.stderr.trim()}`,
      );
    }
    const identity = JSON.parse(result.stdout.trim()) as ProcessIdentity;
    if (
      identity.status !== "dead" &&
      (identity.status !== "alive" || typeof identity.startTime !== "string")
    ) {
      throw new Error(`Invalid process identity response for PID ${pid}`);
    }
    return identity;
  },
};
