# Task 6 Report: Reliable Autosave for Personal Responses

## Scope delivered

- Added a controlled reflection-response field with the exact `idle`, `saving`, `saved`, and `error` states.
- Added 800 ms trailing-edge autosave, superseded-request cancellation, non-2xx error handling, retained local text, and immediate retry.
- Added dirty-only `beforeunload` protection. Successful saves and retries update the baseline; reverting to the saved baseline leaves the UI idle even when an in-flight request is cancelled.
- Added `PUT /api/responses` with malformed-JSON handling, Zod validation, published-chapter and prompt ownership checks across reflection/action/review prompts, fixed `OWNER_ID`, and `try/finally` database cleanup.
- Replaced the chapter workspace's read-only reflection response display with one autosave field per reflection prompt.
- Did not add action or Artifact forms.

## TDD evidence

### RED: autosave component

Command:

```powershell
npm.cmd test -- tests/unit/autosave-field.test.tsx
```

Result: exit 1 because `@/src/components/autosave-field` did not exist. This proved the new component contract had no implementation.

### GREEN: autosave component

The focused component suite passed after the minimal hook and field implementation. It covers the 799/800 ms boundary after the latest input, no repeated save from unstable effects, failed HTTP responses retaining text, immediate successful retry, dirty-only unload protection, AbortError suppression, and superseded request cancellation.

### RED/GREEN: responses API

The first API run failed because `@/app/api/responses/route` did not exist. After implementation, 11/11 route tests passed, covering malformed JSON, Zod-invalid bodies, unpublished/foreign/artifact prompt rejection, all three allowed prompt categories, fixed owner persistence, and response shape.

### RED/GREEN: workspace integration

The new workspace test initially failed because no textbox existed. Replacing only reflection response display with `AutosaveField` made the workspace suite pass.

### Review fix: revert-to-baseline race

Read-only review found that reverting an in-flight edit to the last saved value could leave the displayed state at `saving`. A regression test reproduced the stuck indicator (1 failed, 4 passed). The first attempted fix only masked that stale state and review correctly found it would reappear on the next edit. The next review caught transports that resolve despite aborting. The final hook fix associates both abort rejection and late resolution with the latest controller and truly restores `idle`; regressions prove a subsequent edit stays idle through 799 ms and enters saving at 800 ms, and a late-resolving aborted request cannot leave the field stuck. The component suite passed 6/6.

## Verification

Final command results after the last implementation change:

- Focused autosave/API/workspace/persistence tests: 4 files passed, 28 tests passed.
- Full `npm.cmd test`: 8 files passed, 51 tests passed.
- `npm.cmd run lint`: exit 0, no warnings or errors.
- `npm.cmd run build`: exit 0; TypeScript passed and `/api/responses` built as a dynamic route.
- `git diff --check`: exit 0 (only Git's existing LF-to-CRLF checkout notices).

`tsconfig.tsbuildinfo` remains an unrelated untracked generated file and is excluded from the commit.

## Fix round 1: retry timer, clean baseline, and response payload

### Findings addressed

- Retry now clears the effect-owned debounce timer before starting immediately. `saveValue` rejects aborted or non-current controllers before entering `saving`, so a stale timer cannot leave the field stuck.
- Restoring failed text to the last successful baseline clears the visible state to `idle`, removes error/retry UI, cancels pending work, and performs no extra request. Dirty-to-dirty edits intentionally retain retry during the new debounce window.
- A 2xx response is successful only when its JSON body contains an `updatedAt` string exactly matching the server's `Date#toISOString()` representation. Empty, HTML, missing-field, and invalid-date payloads retain dirty text and expose retry.
- Supersession coverage explicitly captures the old request signal and asserts it is aborted.

### RED/GREEN evidence

Command for each cycle:

```powershell
npm.cmd test -- tests/unit/autosave-field.test.tsx
```

- Retry/timer RED: 1 failed, 6 passed; the stale aborted timer entered `saving` and never recovered. GREEN: 7/7 passed after centralizing timer cleanup and guarding controller identity before save.
- Baseline RED: 1 failed, 7 passed; error/retry remained after restoring the saved text. GREEN: 8/8 passed after clean-baseline state normalization.
- Payload RED: 4 failed, 8 passed; all malformed 2xx payloads incorrectly displayed `已保存`. GREEN: 12/12 passed after response JSON validation.

### Fix verification

- Related autosave, route, workspace, and persistence tests: 4 files passed, 34 tests passed.
- Focused autosave tests: 1 file passed, 12 tests passed.
- Full `npm.cmd test`: 8 files passed, 57 tests passed.
- `npm.cmd run lint`: exit 0.
- `npm.cmd run build`: exit 0; TypeScript passed and `/api/responses` remains dynamic.
- `git diff --check`: exit 0 (only Git's existing LF-to-CRLF checkout notices).
- Independent read-only review: Ready — Yes, no Critical or Important findings.
