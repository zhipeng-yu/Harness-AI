# Task 7 Report: Action Plans and Versioned Artifact Lifecycle

## Scope and schema decision

- Implemented the Task 7 action-plan, Artifact, version, lifecycle, review, API, and chapter-workspace loop.
- Kept `src/lib/db/migrations/001_initial.sql` unchanged. Its existing `artifacts`, `artifact_versions`, and `reviews` tables already provide every required field, foreign key, uniqueness constraint, and status constraint.
- Kept `tsconfig.tsbuildinfo` untracked and excluded from the commit.

## Delivered contract

- `transitionArtifact(current, event)` is a pure, exhaustive lifecycle boundary.
- `artifactRepository(db)` provides `createWithVersion`, `transition`, `addReviewAndNextVersion`, `getByChapter`, and `listForOwner`.
- Version 1 and every next version contain only the immutable `problem`, `principles`, `rules`, and `successCriteria` snapshot plus `revisionNote` metadata.
- `PUT /api/action-plans`, `POST /api/artifacts`, and `PATCH /api/artifacts/[artifactId]` catch malformed JSON, validate discriminated bodies with Zod, use `OWNER_ID` internally, enforce published chapters where chapter input exists, close SQLite in `finally`, and return the same 404 for missing and foreign Artifacts.
- The chapter workspace contains fixed text-only forms: three action fields, four Artifact version fields, and three review fields. It exposes no file-upload or URL input.
- Client lifecycle state and version are updated only from successful server response payloads. Failed requests retain the existing UI state and input.

## TDD evidence

### Lifecycle RED → GREEN

1. Added `tests/unit/artifact-lifecycle.test.ts` first.
2. RED command: `npm.cmd test -- tests/unit/artifact-lifecycle.test.ts`.
3. Observed failure: Vite could not resolve `@/src/features/artifacts/lifecycle` because the module did not exist.
4. Added the transition table and pure function.
5. GREEN result: 25/25 tests passed, covering all 8 legal and all 17 illegal status/event pairs.

### Repository RED → GREEN

1. Added `tests/integration/artifact-repository.test.ts` before the repository.
2. RED command: `npm.cmd test -- tests/integration/artifact-repository.test.ts`.
3. Observed failure: Vite could not resolve `@/src/features/artifacts/repository`.
4. Added the owner-scoped, transaction-safe repository.
5. GREEN coverage includes:
   - Artifact plus version 1 atomic creation;
   - owner-scoped chapter reads, owner lists, and transitions;
   - illegal transitions leave status, current version, and timestamp unchanged;
   - reviews reference the exact immutable version reviewed;
   - review without a next version ends at `reviewed` and does not create a version;
   - immediate and delayed next-version creation both copy all four immutable fields, put `nextChange` only in `revisionNote`, increment to v+1, and return to `draft`.

### Route and UI RED → GREEN

- Route tests first failed because the three route modules did not exist. After implementation, they verify malformed JSON, invalid Zod bodies, unpublished chapters, fixed owner behavior, ownership-safe 404, illegal-transition 409, and server-returned state/version.
- Form tests first failed because the three component modules did not exist. After implementation, they verify exact text-field counts, absence of upload/URL inputs, exact request bodies, server-canonical action fields, and server-canonical lifecycle state.

## Transaction verification

- `createWithVersion` uses `BEGIN IMMEDIATE` through `withTransaction`. A test-only SQLite trigger aborts the version-1 insert; assertions confirm zero rows remain in both `artifacts` and `artifact_versions`.
- `addReviewAndNextVersion` reads the owned current Artifact/version, validates `submit_review`, inserts the linked review, optionally validates `create_next_version`, copies the current snapshot, and updates Artifact version/status inside one transaction.
- A test-only SQLite trigger aborts insertion of version > 1 after the review insert. Assertions confirm rollback to `review_ready`, `current_version = 1`, one original version, and zero reviews.
- Illegal transition validation occurs before update statements inside the transaction, and tests confirm no observable write.

## Verification

- Focused lifecycle/persistence/integration/UI suite:
  - `npm.cmd test -- tests/unit/artifact-lifecycle.test.ts tests/integration/persistence.test.ts tests/integration/artifact-repository.test.ts tests/unit/artifact-routes.test.ts tests/unit/action-artifact-forms.test.tsx tests/unit/chapter-workspace.test.tsx`
  - Result: 6 files passed, 62 tests passed.
- Full suite: `npm.cmd test`
  - Result: 12 files passed, 108 tests passed.
- Lint: `npm.cmd run lint`
  - Result: exit 0, no ESLint findings.
- Production build: `npm.cmd run build`
  - Result: exit 0; TypeScript completed and all three new API routes were emitted.
- Diff hygiene: `git diff --check`
  - Result: exit 0.
- Independent read-only code review:
  - Result: no Critical, Important, or Minor findings. The reviewer confirmed lifecycle, immutable versions, review linkage, transaction rollback, owner isolation, uniform 404 handling, validation, database closure, fixed forms, and server-state synchronization against the Task 7 brief.

Node emitted its existing experimental `node:sqlite` warning during test/build execution; it did not cause failures.
