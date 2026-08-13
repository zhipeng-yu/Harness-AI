# Task 2 Report — 18-Chapter Content Contract

## Status

DONE

## Implementation

- Added the discriminated Zod chapter contract with stable chapter and prompt IDs.
- Added 18 validated, explicitly ordered production chapter records. All are `awaiting_audio`; chapter 1 remains unavailable because the supplied clip is only an introduction.
- Added a complete synthetic published fixture, selected only when both `HARNESS_E2E=1` and `HARNESS_CONTENT_FIXTURE=published-chapter` are present.
- Added content validation and the approved author workflow.

## TDD evidence

### RED

Command:

```powershell
npm.cmd test -- tests/unit/content-schema.test.ts
```

Key output before implementation:

```text
Error: Failed to resolve import "@/content/schema"
```

The missing module was the expected failure. The tests protect acceptance of a reviewed published chapter, rejection of display text as a stable prompt ID, and allowance for metadata-only awaiting-audio chapters.

### GREEN

Commands:

```powershell
npm.cmd test -- tests/unit/content-schema.test.ts
npm.cmd run content:validate
```

Key output:

```text
Tests  3 passed (3)
Validated 18 chapters (0 published).
```

## Final verification

Fresh commands:

```powershell
npm.cmd test
npm.cmd run lint
npm.cmd test -- tests/unit/content-schema.test.ts
npm.cmd run content:validate
git -c safe.directory='E:/Project/ledu_project/Harness AI' diff --check
```

Results: 2 test files / 4 tests passed; ESLint exited 0; focused schema suite passed 3/3; validation reported `Validated 18 chapters (0 published).`; diff check exited 0.

## Files

- `content/schema.ts`
- `content/chapters/registry.ts`
- `content/chapters/chapter-01.ts`
- `content/templates/chapter-template.ts`
- `content/fixtures/e2e-published-chapter.ts`
- `scripts/validate-content.ts`
- `tests/unit/content-schema.test.ts`
- `docs/content-workflow.md`

## Self-review

- `chapterSchema` is a status-discriminated union, and published records require all specified learning sections plus reflections.
- Registry modules are parsed at import; it rejects duplicate IDs, slugs, or orders and missing orders from 1 through 18.
- Fixture selection uses both required environment guards; standard validation sees no published chapters.
- Prompt and artifact-field IDs are explicit stable strings, never derived from visible text.
- Scope is limited to the required contract, test, validator, workflow, and report.

## Concerns

- None.

## Fix round 1 — Review findings

### Changes

- Made the `awaiting_audio` schema branch strict, so processed content such as `problem` is rejected instead of stripped.
- Exported the registry invariant for direct verification and made it reject every registry whose length is not exactly 18, including a 19th duplicate record.
- Added registry tests for the default 18 awaiting-audio chapters, IDs, slugs, exact order coverage, the duplicate-record invariant, and the two-variable E2E fixture gate that replaces only chapter 1.
- Rewrote the author workflow in Chinese.

### Coverage

Updated `tests/unit/content-schema.test.ts` with four new behavior tests. The E2E-gate test resets the module cache and restores environment stubs after each test.

### RED

Command:

```powershell
npm.cmd test -- tests/unit/content-schema.test.ts
```

Key output before the implementation change:

```text
× rejects processed sections on an awaiting-audio chapter
AssertionError: expected [Function] to throw an error
```

This confirmed that Zod was stripping processed fields from an awaiting-audio record.

### GREEN and final verification

Commands:

```powershell
npm.cmd test -- tests/unit/content-schema.test.ts
npm.cmd run content:validate
npm.cmd run lint
git -c safe.directory='E:/Project/ledu_project/Harness AI' diff --check
```

Key output:

```text
Tests  7 passed (7)
Validated 18 chapters (0 published).
```

Lint and `diff --check` both exited 0.
