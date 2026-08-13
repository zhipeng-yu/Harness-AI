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
