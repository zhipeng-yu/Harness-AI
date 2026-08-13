# Task 10 Report — Life-System Visuals and Safe Local Launchers

## Delivered

- Applied the approved organic editorial visual system across the shell, home, chapter map, chapter workspace, and system module views.
- Added the exact forest/paper/sage/orange tokens, 1180px frame, 72ch reading measure, and desktop `190px minmax(0, 1fr) 280px` sticky workspace.
- Added mobile reading layouts, visible keyboard focus, and reduced-motion handling without fonts, packages, gradients-as-decoration, or global machine changes.
- Added safe PowerShell start/stop scripts and exact three-line CMD wrappers.
- Documented double-click and manual local usage in `readme.md`.

## Launcher safety contract

- Node 24+ and project-local `node_modules` are required; missing dependencies produce the exact Chinese install instruction.
- Port `127.0.0.1:3000` is checked before backup, migration, validation, build, or server start.
- An existing database is backed up and verified by `db:backup` before migration.
- The child command is exactly `node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3000` and the server window is hidden.
- `.runtime/server.json` is written without a BOM and records PID plus UTC start time. A failed launch does not delete pre-existing state or leave state owned by the failed launch.
- Stop rejects reparse-point escapes, malformed/unreadable state, invalid PID/time, and identity mismatches. It only stops a process whose start time matches within one second, and only removes `server.json` after confirmed termination.

## TDD evidence

- Launcher suite was first observed failing because scripts did not exist.
- Behavior tests execute real PowerShell orchestration with explicit test seams for port/npm/start failures; stopper tests use only test-owned sleeper processes.
- Added regression cycles for preserving pre-existing runtime state, permission-denied reads, and failed stop confirmation.
- Current launcher suite: 16 behavior tests.

## Verification

- `npm.cmd test`: 16 files, 167 tests passed.
- `npm.cmd run lint`: passed with no warnings or errors.
- `npm.cmd run build`: production build passed, including TypeScript and route generation.
- PowerShell scripts parse successfully.
- CMD wrappers match the approved three-line contents exactly.
- Port 3000 was free and `.runtime` contained no server record during the read-only safety gate.
- Manual browser start/stop was intentionally left to the controller's independent final gate; no browser or production server was launched by this task worker.

## Scope and repository state

- `tsconfig.tsbuildinfo` was left untouched and untracked.
- No dependencies were installed and no firewall, global PowerShell policy, or user configuration was changed.

## Review fix round 1

- Removed every production `HARNESS_LAUNCHER_TEST` / `HARNESS_STOPPER_TEST` branch. Inherited test-looking environment variables cannot bypass Node, dependency, port, build, readiness, or identity gates.
- Refactored the scripts into dot-sourceable `Invoke-HarnessStart` and `Invoke-HarnessStop` functions while keeping normal `.ps1` execution unchanged. Tests replace commands only in their own PowerShell process; the double-click wrappers cannot activate those replacements.
- Replaced the address-filtered port query with `.NET` active TCP listener inspection across IPv4, IPv6, wildcard, and loopback addresses. A real test-owned Node listener on `0.0.0.0:3000` verifies that no backup or other project command runs.
- Added a bounded HTTP readiness loop for `http://127.0.0.1:3000`. Runtime state and browser opening now happen only after readiness. Real Node fixtures cover immediate readiness, delayed readiness, early exit, and timeout.
- Failed startup stops and confirms the exact child process. If cleanup cannot stop it, the script writes its real PID/start time and instructs the user to run `Stop-Harness.cmd` instead of deleting recoverable state.
- The stopper now refreshes and rechecks the same captured `Process` object immediately before `Stop-Process -InputObject`, waits on that object, and removes state only after confirmed exit. A simulated replaced identity proves no replacement process is stopped.
- Kept `--action: #c86b35` unchanged while moving orange to borders on paper; action and alert text now uses `--ink` on `--paper`. The deterministic contrast test verifies a ratio of at least 4.5:1.
- The production server launches the Next CLI directly through the Node executable, so no extra shell process is introduced. The review found no evidence of launcher-created descendants requiring tree termination.
- Review focused verification: 2 files, 19 tests passed.
- Review final verification: 17 files and 170 tests passed; lint passed with no errors or warnings; production build passed TypeScript and route generation; both PowerShell scripts parsed; CMD wrappers remained exact; production test seams were absent; diff check passed; port 3000 had no listener after tests.
