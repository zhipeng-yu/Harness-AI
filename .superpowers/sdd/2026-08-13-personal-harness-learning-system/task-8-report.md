# Task 8 Report: Personal Harness System View

## Delivered contract

- Added the dynamic `/system` page backed by `artifactRepository(db).listForOwner(OWNER_ID)` and closed SQLite in `finally`.
- Rendered exactly one `SystemModuleCard` per Artifact in the required non-empty group order: `in_practice`, `review_ready`, `draft`, `reviewed`, `archived`.
- Added the exact Chinese state labels: `实践中`, `等待复盘`, `草稿`, `已复盘`, and `已归档`.
- Each card shows its current `vN`, Chinese state, `第NN章` source, latest review's next change, and a chronological immutable version history.
- Each version `<details>` contains its creation time, problem, principles, rules, success criteria, revision note, and reviews linked by `artifactVersionId`; review summaries include their time, actual result, effective practice, and next change.
- Archived Artifacts remain readable through the same card and history. The system view exposes no edit or delete action.
- Added exactly three primary navigation links: `我的首页`, `18章地图`, and `我的系统`.
- Kept `tsconfig.tsbuildinfo` untracked and excluded from the commit.

## TDD evidence

1. Added `tests/unit/system-module-card.test.tsx` before production components.
2. RED command: `npm.cmd test -- tests/unit/system-module-card.test.tsx`.
3. Observed expected failure: Vite could not resolve the missing `@/src/components/system-module-card` module.
4. Added the card and version-history components.
5. GREEN command: `npm.cmd test -- tests/unit/system-module-card.test.tsx`.
6. Result: 1 test passed, proving the current version, Chinese state, source chapter, and next change are visible.

## Verification

- Focused component test: `npm.cmd test -- tests/unit/system-module-card.test.tsx`
  - Result: 1 file passed, 1 test passed.
- Full suite: `npm.cmd test`
  - Result: 13 files passed, 109 tests passed.
- Lint: `npm.cmd run lint`
  - Result: exit 0, no ESLint findings.
- Production build: `npm.cmd run build`
  - Result: exit 0; TypeScript completed and `/system` was emitted as a dynamic route.
- Diff hygiene: `git diff --check`
  - Result: exit 0.
- Requirement self-review:
  - Confirmed the group and navigation order, exact labels, one-card-per-Artifact mapping, empty-group hiding, complete linked version history, `try/finally` database lifecycle, readable archives, and absence of mutation/delete controls.

Node emitted its existing experimental `node:sqlite` warning during test/build execution; it did not cause failures.
