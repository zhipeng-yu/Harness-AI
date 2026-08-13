# Personal Harness Learning System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the phase-one, local-only personal growth website that turns an 18-chapter course into guided learning, action plans, versioned text Artifacts, and practice reviews.

**Architecture:** Use one Next.js 16 App Router process for server-rendered pages and route handlers. Keep reviewed course content in version-controlled TypeScript files, keep private owner data in a local SQLite database behind a small repository layer, and use a stable internal owner ID so a future invitation-based multi-user phase can be added without migrating the owner's learning records.

**Tech Stack:** Node.js 24.14+, Next.js 16, React 19, TypeScript 5, native `node:sqlite`, Zod 4, Vitest 4, Testing Library, Playwright, plain CSS/CSS Modules, PowerShell launch scripts.

## Global Constraints

- Phase one is single-user and bound to `127.0.0.1`; do not add authentication, invitation codes, LAN binding, tunnels, or public deployment.
- Show processed learning content only; never expose original audio or internal transcripts in the site.
- All 18 chapters are visible, but only `published` chapters can open; unavailable chapters explain that their audio has not been processed yet.
- Do not call an AI model at runtime and do not add a CMS, file uploads, external Artifact links, calendars, streaks, points, badges, rankings, or notifications.
- Preserve separate statuses for learning, action planning, Artifact creation, practice, and review; recommendations guide but never lock navigation.
- Artifact content is structured text with immutable versions. Archive instead of destructive deletion.
- Store course content in Git and private growth data in `data/harness.sqlite`; never commit the database or backups.
- Every content ID (`chapterId`, `promptId`, and template field ID) is stable and must not be derived from display text.
- All mutating inputs are validated with Zod on the server, and all private repository calls require the stable owner ID `owner-local`.
- Desktop is the primary target. Mobile needs basic reading access only.
- Use Chinese interface copy and the approved “生命系统” visual direction: deep green, warm off-white, and restrained orange action accents.
- Run `npm test`, `npm run lint`, `npm run build`, and the relevant Playwright test before claiming the implementation complete.

## File Structure

```text
app/
  api/
    action-plans/route.ts             # Create/update one chapter action plan
    artifacts/route.ts                # Create Artifact and first immutable version
    artifacts/[artifactId]/route.ts   # Apply lifecycle transitions and reviews
    progress/route.ts                 # Save chapter learning stage
    responses/route.ts                # Autosave one fixed-prompt response
  chapters/[slug]/page.tsx            # Chapter workspace
  chapters/page.tsx                   # 18-chapter map
  system/page.tsx                     # Personal Harness System
  globals.css                         # Approved visual tokens and global layout
  layout.tsx                          # App shell and primary navigation
  page.tsx                            # Dashboard and next-action recommendation
content/
  chapters/
    chapter-01.ts                     # First reviewed chapter; initially awaiting full audio
    registry.ts                       # Stable metadata for all 18 chapters
  schema.ts                           # Zod contract for reviewed course content
  fixtures/e2e-published-chapter.ts   # Test-only complete chapter module
  templates/chapter-template.ts       # Copyable chapter-authoring template
docs/
  content-workflow.md                 # Audio-to-reviewed-chapter release checklist
scripts/
  db-backup.ts                        # Create and verify dated SQLite backups
  db-migrate.ts                       # Apply ordered SQL migrations
  db-restore.ts                       # Validate, safety-backup, then restore
  validate-content.ts                 # Validate all chapter modules
  Start-Harness.ps1                   # Build, migrate, start on localhost, open browser
  Stop-Harness.ps1                    # Stop only the recorded local process
  Start-Harness.cmd                   # Double-click wrapper for PowerShell starter
  Stop-Harness.cmd                    # Double-click wrapper for PowerShell stopper
src/
  components/
    app-shell.tsx                     # Navigation and desktop shell
    autosave-field.tsx                # Textarea with save-state UI
    chapter-map.tsx                   # 18-chapter overview
    chapter-workspace.tsx             # Six-stage chapter interaction
    recommendation-card.tsx           # One primary next action
  features/
    actions/repository.ts             # Action plan persistence
    artifacts/repository.ts           # Artifact, version, lifecycle, review persistence
    progress/repository.ts            # Chapter progress persistence
    recommendations/next-action.ts    # Pure recommendation rules
    responses/repository.ts           # Prompt response persistence
  lib/
    db/connection.ts                  # Native SQLite connection and transaction boundary
    db/migrate.ts                     # Migration runner
    db/migrations/001_initial.sql      # Phase-one schema
    owner.ts                           # Stable owner-local constant
    paths.ts                           # Data, backup, and runtime paths
  types/learning.ts                   # Shared domain types
tests/
  e2e/personal-growth-flow.spec.ts     # Full first-phase acceptance flow
  fixtures/published-chapter.ts        # Valid complete chapter fixture
  integration/content-update.test.ts  # Stable IDs preserve private data
  integration/persistence.test.ts     # Repository persistence across reopen
  unit/artifact-lifecycle.test.ts      # Legal and illegal Artifact transitions
  unit/content-schema.test.ts          # Course contract validation
  unit/next-action.test.ts             # Recommendation priority
vitest.config.ts                       # Node/jsdom test projects
playwright.config.ts                   # Local E2E server and isolated DB
```

---

### Task 1: Create the Local Full-Stack Skeleton

**Files:**
- Create: `package.json`
- Create: `package-lock.json`
- Create: `next.config.mjs`
- Create: `tsconfig.json`
- Create: `eslint.config.mjs`
- Create: `vitest.config.ts`
- Create: `app/layout.tsx`
- Create: `app/page.tsx`
- Create: `app/globals.css`
- Create: `src/components/app-shell.tsx`
- Create: `tests/unit/smoke.test.tsx`
- Modify: `.gitignore`
- Modify: `readme.md`

**Interfaces:**
- Produces: npm scripts `dev`, `build`, `start`, `lint`, `test`, `test:watch`, `test:e2e`, `content:validate`, `db:migrate`, `db:backup`, and `db:restore`.
- Produces: root page containing the heading `超体 · 我的成长操作系统`.
- Consumes: Node.js 24.14+ and npm 11 already available on the machine.

- [ ] **Step 1: Write the failing smoke test**

```tsx
// tests/unit/smoke.test.tsx
import { render, screen } from "@testing-library/react";
import HomePage from "@/app/page";

describe("phase-one application shell", () => {
  it("identifies itself as a personal growth operating system", () => {
    render(<HomePage />);
    expect(
      screen.getByRole("heading", { name: "超体 · 我的成长操作系统" }),
    ).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails before the app exists**

Run: `npm.cmd test -- tests/unit/smoke.test.tsx`

Expected: FAIL because `package.json` and `app/page.tsx` do not exist.

- [ ] **Step 3: Install the pinned major versions and create the project configuration**

Run:

```powershell
npm.cmd install next@16 react@19 react-dom@19 zod@4
npm.cmd install --save-dev typescript@5 @types/node@24 @types/react@19 @types/react-dom@19 eslint eslint-config-next@16 vitest@4 vite@7 jsdom @testing-library/react @testing-library/jest-dom @playwright/test tsx
```

Set these scripts in `package.json`:

```json
{
  "scripts": {
    "dev": "next dev --hostname 127.0.0.1",
    "build": "next build",
    "start": "next start --hostname 127.0.0.1 --port 3000",
    "lint": "eslint .",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "content:validate": "tsx scripts/validate-content.ts",
    "db:migrate": "tsx scripts/db-migrate.ts",
    "db:backup": "tsx scripts/db-backup.ts",
    "db:restore": "tsx scripts/db-restore.ts"
  }
}
```

Configure `vitest.config.ts` with the `@` alias, `jsdom`, and `@testing-library/jest-dom/vitest` setup. Keep `next.config.mjs` to a default exported empty configuration; do not add experimental framework flags.

- [ ] **Step 4: Implement the minimal page and shared layout**

```tsx
// app/page.tsx
export default function HomePage() {
  return (
    <main>
      <h1>超体 · 我的成长操作系统</h1>
      <p>把课程理解转化为行动、创造与复盘。</p>
    </main>
  );
}
```

`app/layout.tsx` imports `app/globals.css`, declares Chinese metadata, and renders children inside `AppShell` without authentication checks. `AppShell` initially renders only a local product label and its children; Tasks 4 and 8 add navigation targets when those pages exist.

- [ ] **Step 5: Extend ignore rules and document the minimum runtime**

Add `.runtime/`, `playwright-report/`, `test-results/`, and `coverage/` to `.gitignore`. Replace the empty `readme.md` with a short phase-one description plus Node.js 24.14+ and `npm.cmd run dev` instructions.

- [ ] **Step 6: Verify the skeleton**

Run:

```powershell
npm.cmd test -- tests/unit/smoke.test.tsx
npm.cmd run lint
npm.cmd run build
```

Expected: one passing smoke test, zero lint errors, and a successful Next.js production build.

- [ ] **Step 7: Commit the skeleton**

```powershell
git add package.json package-lock.json next.config.mjs tsconfig.json eslint.config.mjs vitest.config.ts app src/components/app-shell.tsx tests/unit/smoke.test.tsx .gitignore readme.md
git commit -m "feat: scaffold local personal growth app"
```

---

### Task 2: Define and Validate the 18-Chapter Content Contract

**Files:**
- Create: `content/schema.ts`
- Create: `content/chapters/registry.ts`
- Create: `content/chapters/chapter-01.ts`
- Create: `content/templates/chapter-template.ts`
- Create: `content/fixtures/e2e-published-chapter.ts`
- Create: `scripts/validate-content.ts`
- Create: `tests/unit/content-schema.test.ts`
- Create: `docs/content-workflow.md`

**Interfaces:**
- Produces: `ChapterDefinition`, `ChapterStatus`, and `chapterSchema` from `content/schema.ts`.
- Produces: `getChapters(): readonly ChapterDefinition[]`, `getChapterBySlug(slug)`, and `getPublishedChapters()` from `content/chapters/registry.ts`.
- Contract: IDs use `chapter-01` through `chapter-18`; prompt IDs are explicit strings such as `chapter-01-reflection-01`.
- Contract: an `awaiting_audio` chapter contains metadata only; a `published` chapter must contain every learning section and at least one reflection prompt.

- [ ] **Step 1: Write schema tests for valid, invalid, and unavailable chapters**

```ts
// tests/unit/content-schema.test.ts
import { chapterSchema } from "@/content/schema";
import { publishedChapterFixture } from "@/content/fixtures/e2e-published-chapter";

describe("chapter content contract", () => {
  it("accepts a fully reviewed published chapter", () => {
    expect(chapterSchema.parse(publishedChapterFixture).status).toBe("published");
  });

  it("rejects display text used as a prompt id", () => {
    const invalid = structuredClone(publishedChapterFixture);
    invalid.reflectionPrompts[0].id = "我现在遇到什么问题？";
    expect(() => chapterSchema.parse(invalid)).toThrow();
  });

  it("allows an awaiting-audio chapter without processed sections", () => {
    expect(
      chapterSchema.parse({
        id: "chapter-18",
        slug: "chapter-18",
        order: 18,
        title: "第18章（等待音频）",
        status: "awaiting_audio",
      }).status,
    ).toBe("awaiting_audio");
  });
});
```

- [ ] **Step 2: Run the schema test and confirm the missing module failure**

Run: `npm.cmd test -- tests/unit/content-schema.test.ts`

Expected: FAIL because `content/schema.ts` does not exist.

- [ ] **Step 3: Implement the discriminated content schema**

```ts
// content/schema.ts
import { z } from "zod";

const stableId = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)+$/);
const promptSchema = z.object({ id: stableId, question: z.string().min(4) });
const artifactFieldSchema = z.object({ id: stableId, label: z.string().min(2) });

const baseChapter = z.object({
  id: z.string().regex(/^chapter-(0[1-9]|1[0-8])$/),
  slug: z.string().regex(/^chapter-(0[1-9]|1[0-8])$/),
  order: z.number().int().min(1).max(18),
  title: z.string().min(2),
});

const awaitingChapter = baseChapter.extend({ status: z.literal("awaiting_audio") });
const publishedChapter = baseChapter.extend({
  status: z.literal("published"),
  problem: z.string().min(20),
  oneSentence: z.string().min(10),
  coreStructure: z.array(z.object({ title: z.string(), body: z.string() })).min(2),
  explanation: z.array(z.object({ heading: z.string(), body: z.string() })).min(1),
  concepts: z.array(z.object({ term: z.string(), meaning: z.string() })).min(1),
  scenarios: z.array(z.string().min(6)).min(1),
  misconceptions: z.array(z.string().min(6)).min(1),
  reflectionPrompts: z.array(promptSchema).min(1),
  actionPrompt: promptSchema,
  artifactTemplate: z.object({
    title: z.string().min(2),
    fields: z.array(artifactFieldSchema).min(4),
  }),
  reviewPrompts: z.array(promptSchema).min(3),
});

export const chapterSchema = z.discriminatedUnion("status", [
  awaitingChapter,
  publishedChapter,
]);
export type ChapterDefinition = z.infer<typeof chapterSchema>;
export type ChapterStatus = ChapterDefinition["status"];
```

- [ ] **Step 4: Create the registry with exactly 18 stable records**

`content/chapters/registry.ts` must parse all modules at import time, assert unique IDs, slugs, and orders, and assert the set of orders equals `1..18`. `chapter-01.ts` starts as `awaiting_audio` because the provided 24.85-second clip is only an introduction, not the full first chapter. Chapters 2–18 start as explicit `awaiting_audio` records. `content/fixtures/e2e-published-chapter.ts` contains a complete synthetic chapter used only when both `HARNESS_E2E=1` and `HARNESS_CONTENT_FIXTURE=published-chapter`; it is never displayed in normal operation.

- [ ] **Step 5: Add the validator and author workflow**

```ts
// scripts/validate-content.ts
import { getChapters } from "../content/chapters/registry";

const chapters = getChapters();
const published = chapters.filter((chapter) => chapter.status === "published").length;
console.log(`Validated ${chapters.length} chapters (${published} published).`);
```

`docs/content-workflow.md` records the approved sequence: inspect audio, create internal transcript, clean speech, flag missing visuals, extract structure, fill the fixed chapter contract, check fidelity, request owner approval, publish, run validation, and delete workspace transcript after approval without touching the user's source audio.

- [ ] **Step 6: Run content tests and validation**

Run:

```powershell
npm.cmd test -- tests/unit/content-schema.test.ts
npm.cmd run content:validate
```

Expected: three passing tests and `Validated 18 chapters (0 published).`

- [ ] **Step 7: Commit the content contract**

```powershell
git add content scripts/validate-content.ts tests/unit/content-schema.test.ts docs/content-workflow.md
git commit -m "feat: define reviewed chapter content contract"
```

---

### Task 3: Add SQLite Migrations and Persistence Boundaries

**Files:**
- Create: `src/lib/owner.ts`
- Create: `src/lib/paths.ts`
- Create: `src/lib/db/connection.ts`
- Create: `src/lib/db/migrate.ts`
- Create: `src/lib/db/migrations/001_initial.sql`
- Create: `scripts/db-migrate.ts`
- Create: `src/types/learning.ts`
- Create: `src/features/progress/repository.ts`
- Create: `src/features/responses/repository.ts`
- Create: `src/features/actions/repository.ts`
- Create: `tests/integration/persistence.test.ts`

**Interfaces:**
- Produces: `OWNER_ID = "owner-local"`.
- Produces: `openDatabase(path?: string): DatabaseSync`, `migrate(db): string[]`, and `withTransaction<T>(db, work): T`.
- Produces: `progressRepository(db)`, `responseRepository(db)`, and `actionPlanRepository(db)` with owner ID required on every method.
- Consumes: `chapterId` and `promptId` from the content contract; the database never stores copied course text.

- [ ] **Step 1: Write persistence-across-reopen integration tests**

```ts
// tests/integration/persistence.test.ts
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDatabase } from "@/src/lib/db/connection";
import { migrate } from "@/src/lib/db/migrate";
import { responseRepository } from "@/src/features/responses/repository";

it("keeps a prompt response after the database is reopened", () => {
  const path = join(mkdtempSync(join(tmpdir(), "harness-db-")), "test.sqlite");
  let db = openDatabase(path);
  migrate(db);
  responseRepository(db).upsert({
    ownerId: "owner-local",
    chapterId: "chapter-01",
    promptId: "chapter-01-reflection-01",
    value: "我在内容创作中频繁切换目标。",
  });
  db.close();

  db = openDatabase(path);
  expect(
    responseRepository(db).get(
      "owner-local",
      "chapter-01",
      "chapter-01-reflection-01",
    )?.value,
  ).toBe("我在内容创作中频繁切换目标。");
  db.close();
});
```

- [ ] **Step 2: Run the persistence test and verify it fails**

Run: `npm.cmd test -- tests/integration/persistence.test.ts`

Expected: FAIL because the database connection and repositories do not exist.

- [ ] **Step 3: Create the strict initial migration**

`001_initial.sql` must create `schema_migrations`, `owners`, `chapter_progress`, `responses`, `action_plans`, `artifacts`, `artifact_versions`, `reviews`, and `backup_records`. Use foreign keys, `STRICT` tables, `CHECK` constraints for enum states, and composite uniqueness for owner/chapter/prompt records. Insert the owner with ID `owner-local` using `INSERT OR IGNORE`.

Use this complete initial schema:

```sql
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS schema_migrations (
  id TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL
) STRICT;

CREATE TABLE owners (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  created_at TEXT NOT NULL
) STRICT;

CREATE TABLE chapter_progress (
  owner_id TEXT NOT NULL REFERENCES owners(id),
  chapter_id TEXT NOT NULL,
  learning_stage TEXT NOT NULL DEFAULT 'not_started'
    CHECK (learning_stage IN ('not_started', 'understanding', 'learned')),
  updated_at TEXT NOT NULL,
  PRIMARY KEY (owner_id, chapter_id)
) STRICT;

CREATE TABLE responses (
  owner_id TEXT NOT NULL REFERENCES owners(id),
  chapter_id TEXT NOT NULL,
  prompt_id TEXT NOT NULL,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (owner_id, chapter_id, prompt_id)
) STRICT;

CREATE TABLE action_plans (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES owners(id),
  chapter_id TEXT NOT NULL,
  problem TEXT NOT NULL,
  action TEXT NOT NULL,
  success_criteria TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (owner_id, chapter_id)
) STRICT;

CREATE TABLE artifacts (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES owners(id),
  chapter_id TEXT NOT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'in_practice', 'review_ready', 'reviewed', 'archived')),
  current_version INTEGER NOT NULL DEFAULT 1 CHECK (current_version > 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  archived_at TEXT
) STRICT;

CREATE TABLE artifact_versions (
  id TEXT PRIMARY KEY,
  artifact_id TEXT NOT NULL REFERENCES artifacts(id),
  version INTEGER NOT NULL CHECK (version > 0),
  problem TEXT NOT NULL,
  principles TEXT NOT NULL,
  rules TEXT NOT NULL,
  success_criteria TEXT NOT NULL,
  revision_note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  UNIQUE (artifact_id, version)
) STRICT;

CREATE TABLE reviews (
  id TEXT PRIMARY KEY,
  artifact_id TEXT NOT NULL REFERENCES artifacts(id),
  artifact_version_id TEXT NOT NULL REFERENCES artifact_versions(id),
  actual_result TEXT NOT NULL,
  effective TEXT NOT NULL,
  next_change TEXT NOT NULL,
  created_at TEXT NOT NULL
) STRICT;

CREATE TABLE backup_records (
  id TEXT PRIMARY KEY,
  path TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL CHECK (kind IN ('manual', 'automatic', 'pre_restore')),
  verified_at TEXT NOT NULL,
  created_at TEXT NOT NULL
) STRICT;

INSERT OR IGNORE INTO owners (id, display_name, created_at)
VALUES ('owner-local', '我的成长系统', CURRENT_TIMESTAMP);
```

The Artifact state check is exactly:

```sql
CHECK (status IN ('draft', 'in_practice', 'review_ready', 'reviewed', 'archived'))
```

The chapter progress row contains `learning_stage` with exactly:

```sql
CHECK (learning_stage IN ('not_started', 'understanding', 'learned'))
```

- [ ] **Step 4: Implement the native SQLite adapter and migration transaction**

```ts
// src/lib/db/connection.ts
import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

export function openDatabase(path = process.env.HARNESS_DB_PATH ?? "data/harness.sqlite") {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path, { timeout: 5_000 });
  db.exec("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;");
  return db;
}

export function withTransaction<T>(db: DatabaseSync, work: () => T): T {
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = work();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
```

`migrate(db)` reads ordered `.sql` files, applies each unapplied migration inside one transaction, and records its filename only after the SQL succeeds. A failed migration throws and leaves no partial schema changes.

Implement the migration boundary with this algorithm:

```ts
export function migrate(db: DatabaseSync): string[] {
  db.exec("CREATE TABLE IF NOT EXISTS schema_migrations (id TEXT PRIMARY KEY, applied_at TEXT NOT NULL) STRICT");
  const applied = new Set(
    db.prepare("SELECT id FROM schema_migrations").all().map((row) => String(row.id)),
  );
  const completed: string[] = [];
  for (const file of orderedMigrationFiles()) {
    if (applied.has(file.name)) continue;
    withTransaction(db, () => {
      db.exec(readFileSync(file.path, "utf8"));
      db.prepare("INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)")
        .run(file.name, new Date().toISOString());
    });
    completed.push(file.name);
  }
  return completed;
}
```

- [ ] **Step 5: Implement focused repositories with prepared statements**

Each repository validates ownership in its `WHERE` clause. The response upsert signature is:

Define the shared status types once in `src/types/learning.ts`:

```ts
export type LearningStage = "not_started" | "understanding" | "learned";
export type ArtifactStatus = "draft" | "in_practice" | "review_ready" | "reviewed" | "archived";
export type ArtifactEvent =
  | "start_practice"
  | "mark_review_ready"
  | "submit_review"
  | "create_next_version"
  | "archive";

export type NextAction =
  | { kind: "continue_learning"; chapterId: string }
  | { kind: "plan_action"; chapterId: string }
  | { kind: "create_artifact"; chapterId: string }
  | { kind: "review_artifact"; artifactId: string }
  | { kind: "start_chapter"; chapterId: string };
```

```ts
upsert(input: {
  ownerId: string;
  chapterId: string;
  promptId: string;
  value: string;
}): { updatedAt: string };
```

The action plan repository exposes `get(ownerId, chapterId)` and `upsert({ ownerId, chapterId, problem, action, successCriteria })`. The progress repository exposes `get`, `listForOwner`, and `setLearningStage`.

- [ ] **Step 6: Run database tests twice to prove idempotent migration**

Run:

```powershell
npm.cmd test -- tests/integration/persistence.test.ts
$env:HARNESS_DB_PATH='data/plan-verification.sqlite'; npm.cmd run db:migrate; npm.cmd run db:migrate; Remove-Item -LiteralPath 'data/plan-verification.sqlite' -Force
```

Expected: test passes; both migration commands exit zero; the second reports zero new migrations.

- [ ] **Step 7: Commit the persistence layer**

```powershell
git add src/lib src/types src/features/progress src/features/responses src/features/actions scripts/db-migrate.ts tests/integration/persistence.test.ts
git commit -m "feat: add local sqlite persistence"
```

---

### Task 4: Implement the Chapter Map and Next-Action Recommendation

**Files:**
- Create: `src/features/recommendations/next-action.ts`
- Create: `tests/unit/next-action.test.ts`
- Create: `src/components/recommendation-card.tsx`
- Create: `src/components/chapter-map.tsx`
- Modify: `app/page.tsx`
- Create: `app/chapters/page.tsx`

**Interfaces:**
- Produces: `recommendNextAction(input: RecommendationInput): NextAction | null` as a pure function.
- `NextAction.kind` is one of `continue_learning`, `plan_action`, `create_artifact`, `review_artifact`, or `start_chapter`.
- Consumes: published chapter registry plus owner progress/action/Artifact summaries.

- [ ] **Step 1: Write recommendation-priority tests**

```ts
// tests/unit/next-action.test.ts
import { recommendNextAction } from "@/src/features/recommendations/next-action";

it("prefers unfinished learning over later work", () => {
  const result = recommendNextAction({
    publishedChapterIds: ["chapter-01", "chapter-02"],
    progress: [{ chapterId: "chapter-01", learningStage: "understanding" }],
    actionChapterIds: [],
    artifactChapterIds: [],
    reviewReadyArtifactIds: [],
  });
  expect(result).toMatchObject({ kind: "continue_learning", chapterId: "chapter-01" });
});

it("recommends an action plan after learning is complete", () => {
  const result = recommendNextAction({
    publishedChapterIds: ["chapter-01"],
    progress: [{ chapterId: "chapter-01", learningStage: "learned" }],
    actionChapterIds: [],
    artifactChapterIds: [],
    reviewReadyArtifactIds: [],
  });
  expect(result?.kind).toBe("plan_action");
});
```

Add cases for create Artifact, review-ready Artifact, next published chapter, and no published chapters.

- [ ] **Step 2: Run the recommendation tests and verify failure**

Run: `npm.cmd test -- tests/unit/next-action.test.ts`

Expected: FAIL because `recommendNextAction` does not exist.

- [ ] **Step 3: Implement the exact priority order as a pure function**

The function scans in this order: first `understanding`, then `learned` without action plan, then action plan without Artifact, then review-ready Artifact, then first published chapter with no progress. It never recommends an `awaiting_audio` chapter and never mutates its inputs.

```ts
export function recommendNextAction(input: RecommendationInput): NextAction | null {
  const progress = new Map(input.progress.map((item) => [item.chapterId, item.learningStage]));
  const actions = new Set(input.actionChapterIds);
  const artifacts = new Set(input.artifactChapterIds);

  for (const chapterId of input.publishedChapterIds) {
    if (progress.get(chapterId) === "understanding") {
      return { kind: "continue_learning", chapterId };
    }
  }
  for (const chapterId of input.publishedChapterIds) {
    if (progress.get(chapterId) === "learned" && !actions.has(chapterId)) {
      return { kind: "plan_action", chapterId };
    }
  }
  for (const chapterId of input.publishedChapterIds) {
    if (actions.has(chapterId) && !artifacts.has(chapterId)) {
      return { kind: "create_artifact", chapterId };
    }
  }
  const artifactId = input.reviewReadyArtifactIds[0];
  if (artifactId) return { kind: "review_artifact", artifactId };
  for (const chapterId of input.publishedChapterIds) {
    if (!progress.has(chapterId)) return { kind: "start_chapter", chapterId };
  }
  return null;
}
```

- [ ] **Step 4: Render the dashboard and full map**

`app/page.tsx` opens/migrates the database, loads owner summaries, calls `recommendNextAction`, and renders exactly one primary recommendation plus counts of open actions, Artifacts, and reviews. `app/chapters/page.tsx` renders all 18 chapters. Awaiting chapters are visible but link to no workspace and display `等待完整音频`.

- [ ] **Step 5: Verify rule tests and server rendering**

Run:

```powershell
npm.cmd test -- tests/unit/next-action.test.ts
npm.cmd run build
```

Expected: all recommendation tests pass and both `/` and `/chapters` build without database initialization errors.

- [ ] **Step 6: Commit dashboard navigation**

```powershell
git add src/features/recommendations src/components/recommendation-card.tsx src/components/chapter-map.tsx app/page.tsx app/chapters/page.tsx tests/unit/next-action.test.ts
git commit -m "feat: add chapter map and next action guidance"
```

---

### Task 5: Build the Six-Stage Chapter Workspace

**Files:**
- Create: `src/components/chapter-workspace.tsx`
- Create: `src/components/progress-stepper.tsx`
- Create: `app/api/progress/route.ts`
- Create: `app/chapters/[slug]/page.tsx`
- Create: `tests/unit/chapter-workspace.test.tsx`

**Interfaces:**
- Consumes: a `published` `ChapterDefinition`, saved responses, action summary, Artifact summary, and `learningStage`.
- Produces: `PUT /api/progress` accepting `{ chapterId, learningStage }` and returning `{ learningStage, updatedAt }`.
- Route behavior: return 404 for unknown or awaiting-audio slugs; never render a partial chapter as published.

- [ ] **Step 1: Write workspace behavior tests**

```tsx
// tests/unit/chapter-workspace.test.tsx
import { render, screen } from "@testing-library/react";
import { ChapterWorkspace } from "@/src/components/chapter-workspace";
import { publishedChapterFixture } from "@/content/fixtures/e2e-published-chapter";

it("shows the six stages and the chapter's real problem", () => {
  render(
    <ChapterWorkspace
      chapter={publishedChapterFixture}
      learningStage="not_started"
      savedResponses={{}}
      actionPlan={null}
      artifact={null}
    />,
  );
  expect(screen.getAllByRole("listitem")).toHaveLength(6);
  expect(screen.getByText(publishedChapterFixture.problem)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the test and verify the missing component failure**

Run: `npm.cmd test -- tests/unit/chapter-workspace.test.tsx`

Expected: FAIL because the workspace does not exist.

- [ ] **Step 3: Implement stage rendering and explicit learning completion**

The stages are `进入本章`, `理解系统`, `照见自己`, `行动设计`, `创建 Artifact`, and `实践复盘`. Reading does not automatically mark a chapter learned. The user explicitly selects `完成本章学习`, which calls `PUT /api/progress` with `learningStage: "learned"`. Opening a chapter with no progress sets `understanding` once.

The route handler uses this exact validation boundary:

```ts
const progressInput = z.object({
  chapterId: z.string().regex(/^chapter-(0[1-9]|1[0-8])$/),
  learningStage: z.enum(["understanding", "learned"]),
});

export async function PUT(request: Request) {
  const parsed = progressInput.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: "invalid_progress" }, { status: 400 });
  const chapter = getChapters().find((item) => item.id === parsed.data.chapterId);
  if (!chapter || chapter.status !== "published") {
    return Response.json({ error: "chapter_not_published" }, { status: 404 });
  }
  const db = openDatabase();
  migrate(db);
  const saved = progressRepository(db).setLearningStage(OWNER_ID, parsed.data.chapterId, parsed.data.learningStage);
  db.close();
  return Response.json(saved);
}
```

- [ ] **Step 4: Implement the workspace route**

`app/chapters/[slug]/page.tsx` obtains the chapter via `getChapterBySlug`, calls `notFound()` unless it is published, loads owner-local private data, and renders the three-column layout. The right summary remains visible with CSS `position: sticky` on desktop.

- [ ] **Step 5: Verify workspace tests and route build**

Run:

```powershell
npm.cmd test -- tests/unit/chapter-workspace.test.tsx
npm.cmd run build
```

Expected: workspace tests pass and the dynamic route builds.

- [ ] **Step 6: Commit the workspace**

```powershell
git add src/components/chapter-workspace.tsx src/components/progress-stepper.tsx app/api/progress app/chapters tests/unit/chapter-workspace.test.tsx
git commit -m "feat: add guided chapter workspace"
```

---

### Task 6: Add Reliable Autosave for Personal Responses

**Files:**
- Create: `src/components/autosave-field.tsx`
- Create: `src/components/use-autosave.ts`
- Create: `app/api/responses/route.ts`
- Create: `tests/unit/autosave-field.test.tsx`
- Modify: `src/components/chapter-workspace.tsx`

**Interfaces:**
- Produces: `AutosaveField` props `{ chapterId, promptId, label, initialValue }`.
- Produces: `PUT /api/responses` accepting `{ chapterId, promptId, value }`, returning `{ updatedAt }`.
- Save states are exactly `idle`, `saving`, `saved`, and `error`.
- The server rejects prompt IDs that do not exist in the referenced published chapter.

- [ ] **Step 1: Write autosave success and retry tests with fake timers**

```tsx
// tests/unit/autosave-field.test.tsx
it("saves 800ms after typing stops", async () => {
  vi.useFakeTimers();
  const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(JSON.stringify({ updatedAt: "2026-08-13T00:00:00.000Z" })),
  );
  render(
    <AutosaveField
      chapterId="chapter-01"
      promptId="chapter-01-reflection-01"
      label="我的现实问题"
      initialValue=""
    />,
  );
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "真实场景" } });
  await vi.advanceTimersByTimeAsync(800);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(await screen.findByText("已保存")).toBeInTheDocument();
});
```

Add a failed-response case that keeps textarea content and exposes a `重试保存` button.

- [ ] **Step 2: Run the autosave tests and verify failure**

Run: `npm.cmd test -- tests/unit/autosave-field.test.tsx`

Expected: FAIL because `AutosaveField` is missing.

- [ ] **Step 3: Implement debounced save without silent data loss**

`useAutosave` waits 800ms after the latest change, cancels superseded requests with `AbortController`, and never clears local text on error. Register `beforeunload` only while text differs from the last successfully saved value. A successful retry updates the saved baseline.

```ts
export type SaveState = "idle" | "saving" | "saved" | "error";

export function useAutosave(value: string, save: (value: string, signal: AbortSignal) => Promise<void>) {
  const [savedValue, setSavedValue] = useState(value);
  const [state, setState] = useState<SaveState>("idle");
  useEffect(() => {
    if (value === savedValue) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setState("saving");
      try {
        await save(value, controller.signal);
        setSavedValue(value);
        setState("saved");
      } catch (error) {
        if (!controller.signal.aborted) setState("error");
      }
    }, 800);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [value, savedValue, save]);
  return { state, dirty: value !== savedValue };
}
```

- [ ] **Step 4: Validate the server request against published content**

The route uses a Zod body schema, locates the published chapter, checks the prompt ID against its reflection, action, and review prompts, and then writes with `OWNER_ID`. Return 400 for malformed input and 404 for invalid chapter/prompt pairs.

- [ ] **Step 5: Integrate response fields and verify**

Render one `AutosaveField` for every reflection prompt in the chapter fixture. Run:

```powershell
npm.cmd test -- tests/unit/autosave-field.test.tsx tests/integration/persistence.test.ts
npm.cmd run lint
```

Expected: all tests pass and lint reports zero errors.

- [ ] **Step 6: Commit autosave**

```powershell
git add src/components/autosave-field.tsx src/components/use-autosave.ts app/api/responses src/components/chapter-workspace.tsx tests/unit/autosave-field.test.tsx
git commit -m "feat: autosave private chapter responses"
```

---

### Task 7: Implement Action Plans and the Versioned Artifact Lifecycle

**Files:**
- Create: `src/features/artifacts/repository.ts`
- Create: `src/features/artifacts/lifecycle.ts`
- Create: `tests/unit/artifact-lifecycle.test.ts`
- Create: `app/api/action-plans/route.ts`
- Create: `app/api/artifacts/route.ts`
- Create: `app/api/artifacts/[artifactId]/route.ts`
- Create: `src/components/action-plan-form.tsx`
- Create: `src/components/artifact-editor.tsx`
- Create: `src/components/artifact-review-form.tsx`
- Modify: `src/components/chapter-workspace.tsx`

**Interfaces:**
- Produces: `transitionArtifact(current, event): ArtifactStatus` as a pure function.
- Events are `start_practice`, `mark_review_ready`, `submit_review`, `create_next_version`, and `archive`.
- Produces repository methods `createWithVersion`, `transition`, `addReviewAndNextVersion`, `getByChapter`, and `listForOwner`.
- First Artifact version fields are `problem`, `principles`, `rules`, and `successCriteria`; versions are immutable after creation.

- [ ] **Step 1: Write the state-machine tests before repository code**

```ts
// tests/unit/artifact-lifecycle.test.ts
import { transitionArtifact } from "@/src/features/artifacts/lifecycle";

it.each([
  ["draft", "start_practice", "in_practice"],
  ["in_practice", "mark_review_ready", "review_ready"],
  ["review_ready", "submit_review", "reviewed"],
  ["reviewed", "create_next_version", "draft"],
  ["draft", "archive", "archived"],
])("moves %s via %s to %s", (from, event, expected) => {
  expect(transitionArtifact(from, event)).toBe(expected);
});

it("rejects review submission before review-ready", () => {
  expect(() => transitionArtifact("in_practice", "submit_review")).toThrow(
    "Illegal artifact transition",
  );
});
```

- [ ] **Step 2: Run lifecycle tests and verify failure**

Run: `npm.cmd test -- tests/unit/artifact-lifecycle.test.ts`

Expected: FAIL because the lifecycle module does not exist.

- [ ] **Step 3: Implement the pure lifecycle and transaction-safe repository**

`createWithVersion` inserts one Artifact plus version 1 in one transaction. `addReviewAndNextVersion` inserts a review referencing the reviewed immutable version; when `createNextVersion` is true, it copies version fields, applies only `nextChange` to a dedicated `revisionNote`, increments `current_version`, and sets status to `draft`. Illegal transitions write nothing.

```ts
const transitions: Record<ArtifactStatus, Partial<Record<ArtifactEvent, ArtifactStatus>>> = {
  draft: { start_practice: "in_practice", archive: "archived" },
  in_practice: { mark_review_ready: "review_ready", archive: "archived" },
  review_ready: { submit_review: "reviewed", archive: "archived" },
  reviewed: { create_next_version: "draft", archive: "archived" },
  archived: {},
};

export function transitionArtifact(current: ArtifactStatus, event: ArtifactEvent): ArtifactStatus {
  const next = transitions[current][event];
  if (!next) throw new Error(`Illegal artifact transition: ${current} -> ${event}`);
  return next;
}
```

The review transaction follows this order:

```ts
return withTransaction(db, () => {
  const artifact = requireOwnedArtifact(db, ownerId, artifactId);
  const reviewedStatus = transitionArtifact(artifact.status, "submit_review");
  insertReview(db, artifact, input);
  if (!input.createNextVersion) {
    updateArtifactStatus(db, artifact.id, reviewedStatus);
    return { status: reviewedStatus, version: artifact.currentVersion };
  }
  const nextStatus = transitionArtifact(reviewedStatus, "create_next_version");
  const nextVersion = artifact.currentVersion + 1;
  copyVersion(db, artifact.id, artifact.currentVersion, nextVersion, input.nextChange);
  updateArtifactVersionAndStatus(db, artifact.id, nextVersion, nextStatus);
  return { status: nextStatus, version: nextVersion };
});
```

- [ ] **Step 4: Add Zod-validated action and Artifact routes**

`PUT /api/action-plans` accepts `{ chapterId, problem, action, successCriteria }`. `POST /api/artifacts` accepts `{ chapterId, title, problem, principles, rules, successCriteria }`. `PATCH /api/artifacts/[artifactId]` accepts a discriminated union of lifecycle event bodies. Every handler supplies `OWNER_ID` internally and returns 404 if the Artifact does not belong to it.

- [ ] **Step 5: Build fixed, text-only forms**

The action form has exactly three fields: reality problem, action, and observable success criteria. The Artifact editor has the four version fields defined above. The review form has exactly `实际发生了什么`, `什么有效、什么没有`, and `下一版本只改一件什么事`. Do not add upload or URL inputs.

- [ ] **Step 6: Verify state, persistence, and chapter integration**

Run:

```powershell
npm.cmd test -- tests/unit/artifact-lifecycle.test.ts tests/integration/persistence.test.ts
npm.cmd run build
```

Expected: state-machine and persistence tests pass; the workspace builds with action and Artifact panels.

- [ ] **Step 7: Commit the action loop**

```powershell
git add src/features/artifacts app/api/action-plans app/api/artifacts src/components/action-plan-form.tsx src/components/artifact-editor.tsx src/components/artifact-review-form.tsx src/components/chapter-workspace.tsx tests/unit/artifact-lifecycle.test.ts
git commit -m "feat: add action artifact and review loop"
```

---

### Task 8: Build the Personal Harness System View

**Files:**
- Create: `app/system/page.tsx`
- Create: `src/components/system-module-card.tsx`
- Create: `src/components/artifact-version-history.tsx`
- Create: `tests/unit/system-module-card.test.tsx`
- Modify: `app/layout.tsx`

**Interfaces:**
- Consumes: `artifactRepository(db).listForOwner(OWNER_ID)` including immutable versions and reviews.
- Produces: `/system` grouped by active, waiting-for-review, reviewed, and archived modules.
- No delete action is exposed; archived records remain readable.

- [ ] **Step 1: Write the module-card test**

```tsx
it("shows current version, state, source chapter, and next change", () => {
  render(<SystemModuleCard module={reviewedArtifactFixture} />);
  expect(screen.getByText("v2")).toBeInTheDocument();
  expect(screen.getByText("已复盘")).toBeInTheDocument();
  expect(screen.getByText("第03章")).toBeInTheDocument();
  expect(screen.getByText("消息窗口限制为25分钟")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the component test and verify failure**

Run: `npm.cmd test -- tests/unit/system-module-card.test.tsx`

Expected: FAIL because the component is missing.

- [ ] **Step 3: Implement the grouped system page and version history**

Render one card per Artifact, not per version. Expanding a card reveals chronological immutable versions and linked review summaries. Use human labels: `草稿`, `实践中`, `等待复盘`, `已复盘`, `已归档`.

```ts
const groups: Record<ArtifactStatus, ArtifactSummary[]> = {
  draft: [],
  in_practice: [],
  review_ready: [],
  reviewed: [],
  archived: [],
};
for (const artifact of artifacts) groups[artifact.status].push(artifact);
```

Render group order as `in_practice`, `review_ready`, `draft`, `reviewed`, `archived`, hiding only empty groups. Each `<details>` version row shows version number, creation time, four immutable fields, linked review, and revision note.

- [ ] **Step 4: Add stable primary navigation**

`app/layout.tsx` links to `我的首页`, `18章地图`, and `我的系统`. Do not add account, community, administration, or settings links in phase one.

- [ ] **Step 5: Verify personal-system rendering**

Run:

```powershell
npm.cmd test -- tests/unit/system-module-card.test.tsx
npm.cmd run build
```

Expected: test passes and `/system` builds.

- [ ] **Step 6: Commit the personal system**

```powershell
git add app/system app/layout.tsx src/components/system-module-card.tsx src/components/artifact-version-history.tsx tests/unit/system-module-card.test.tsx
git commit -m "feat: assemble personal harness system"
```

---

### Task 9: Protect Private Data During Content Updates and Backups

**Files:**
- Create: `src/lib/db/backup.ts`
- Create: `scripts/db-backup.ts`
- Create: `scripts/db-restore.ts`
- Create: `tests/integration/content-update.test.ts`
- Create: `tests/integration/backup-restore.test.ts`
- Modify: `src/lib/paths.ts`
- Modify: `readme.md`

**Interfaces:**
- Produces: `createVerifiedBackup(dbPath, backupDir): Promise<BackupResult>`.
- Produces: `verifyBackup(path): { integrity: "ok"; ownerCount: number; migrationCount: number }`.
- Produces: `restoreBackup({ source, target, confirm: true }): Promise<void>`.
- Backup filenames are `harness-YYYYMMDD-HHmmss.sqlite`; keep the newest 10 verified automatic backups.
- Defines: `type BackupKind = "manual" | "automatic" | "pre_restore"` and `type BackupResult = { path: string; integrity: "ok"; ownerCount: number; migrationCount: number }`.

- [ ] **Step 1: Write content-update invariance and backup-restore tests**

```ts
it("keeps an answer when chapter display text changes but IDs stay stable", () => {
  const originalPromptId = "chapter-01-reflection-01";
  responseRepository(db).upsert({
    ownerId: "owner-local",
    chapterId: "chapter-01",
    promptId: originalPromptId,
    value: "我的真实回答",
  });
  const revisedQuestion = "换一种说法询问同一件事";
  expect(revisedQuestion).not.toContain(originalPromptId);
  expect(
    responseRepository(db).get("owner-local", "chapter-01", originalPromptId)?.value,
  ).toBe("我的真实回答");
});
```

The backup test creates data, calls `createVerifiedBackup`, deletes the test database, restores the backup, reopens it, and asserts the exact response and Artifact version are present.

- [ ] **Step 2: Run both integration tests and verify failure**

Run: `npm.cmd test -- tests/integration/content-update.test.ts tests/integration/backup-restore.test.ts`

Expected: content test may pass after setup, backup test FAILS because backup functions are missing.

- [ ] **Step 3: Implement verified backup using the native SQLite backup API**

Use `backup(sourceDb, destination)` from `node:sqlite`, then open the destination read-only enough for checks, run `PRAGMA integrity_check`, verify the `owner-local` row and at least one schema migration, close it, and only then record it as verified. Delete only older verified files beyond the newest 10; never delete an unverified file automatically.

```ts
export async function createVerifiedBackup(
  dbPath: string,
  backupDir: string,
  kind: BackupKind = "manual",
): Promise<BackupResult> {
  mkdirSync(backupDir, { recursive: true });
  const destination = join(backupDir, backupFilename(new Date()));
  const source = openDatabase(dbPath);
  migrate(source);
  await backup(source, destination);
  source.close();
  const verification = verifyBackup(destination);
  if (verification.integrity !== "ok") throw new Error("Backup integrity check failed");
  const db = openDatabase(dbPath);
  db.prepare(
    "INSERT INTO backup_records (id, path, kind, verified_at, created_at) VALUES (?, ?, ?, ?, ?)",
  ).run(randomUUID(), destination, kind, new Date().toISOString(), new Date().toISOString());
  db.close();
  pruneVerifiedBackups(backupDir, 10);
  return { path: destination, ...verification };
}
```

- [ ] **Step 4: Implement guarded restore**

`db:restore` requires an existing `.sqlite` path and the literal `--confirm`. It refuses to continue while `.runtime/server.json` identifies a live website process. It verifies the source first, creates a verified `pre-restore` backup of the current database, closes its CLI connections, and copies the source to a validated temporary sibling path. On Windows, rename the current target to `harness.pre-restore.sqlite`, rename the temporary file to the target, verify the new target, then remove the sibling; if either rename or verification fails, move the sibling back to the target before returning an error. Without `--confirm`, exit nonzero without changing files.

The entry command parses arguments explicitly:

```ts
const [source, confirm] = process.argv.slice(2);
if (!source || confirm !== "--confirm") {
  console.error("Usage: npm run db:restore -- <backup.sqlite> --confirm");
  process.exitCode = 2;
} else {
  await restoreBackup({ source: resolve(source), target: resolveDatabasePath(), confirm: true });
}
```

- [ ] **Step 5: Add pre-update operator instructions**

Update `docs/content-workflow.md` and `readme.md`: run `npm.cmd run db:backup` before publishing content changes or schema migrations, run `npm.cmd run content:validate`, then build and visually inspect. Document the exact restore command:

```powershell
npm.cmd run db:restore -- backups/harness-20260813-120000.sqlite --confirm
```

- [ ] **Step 6: Verify real backup recovery**

Run:

```powershell
npm.cmd test -- tests/integration/content-update.test.ts tests/integration/backup-restore.test.ts
npm.cmd run db:backup
```

Expected: both tests pass; CLI prints the verified backup path and `integrity=ok`.

- [ ] **Step 7: Commit protection tooling**

```powershell
git add src/lib/db/backup.ts src/lib/paths.ts scripts/db-backup.ts scripts/db-restore.ts tests/integration docs/content-workflow.md readme.md
git commit -m "feat: verify backup restore and content upgrades"
```

---

### Task 10: Apply the Approved Visual System and Add Safe Local Launchers

**Files:**
- Modify: `app/globals.css`
- Modify: `src/components/app-shell.tsx`
- Modify: all page components created in Tasks 4–8
- Create: `scripts/Start-Harness.ps1`
- Create: `scripts/Stop-Harness.ps1`
- Create: `scripts/Start-Harness.cmd`
- Create: `scripts/Stop-Harness.cmd`
- Create: `tests/unit/launch-script.test.ts`
- Modify: `readme.md`

**Interfaces:**
- Visual tokens: `--forest-900: #173e34`, `--forest-700: #315b47`, `--paper: #f7f8f3`, `--sage: #dce8d9`, `--action: #c86b35`, `--ink: #18352d`.
- Launcher binds only to `127.0.0.1:3000`, writes `.runtime/server.json`, and never changes firewall settings.
- Stopper validates recorded PID plus process start time before stopping it.

- [ ] **Step 1: Write static safety tests for launcher scripts**

```ts
it("binds the site to localhost and does not alter the firewall", () => {
  const start = readFileSync("scripts/Start-Harness.ps1", "utf8");
  expect(start).toContain("127.0.0.1");
  expect(start).not.toMatch(/New-NetFirewallRule|0\.0\.0\.0/);
});

it("checks process identity before stopping it", () => {
  const stop = readFileSync("scripts/Stop-Harness.ps1", "utf8");
  expect(stop).toContain("StartTime");
  expect(stop).toContain("server.json");
});
```

- [ ] **Step 2: Run launcher tests and verify missing-file failure**

Run: `npm.cmd test -- tests/unit/launch-script.test.ts`

Expected: FAIL because launcher scripts do not exist.

- [ ] **Step 3: Apply visual tokens and desktop learning layout**

Use the exact CSS variables above. Content width is at most `1180px`; reading column line length is at most `72ch`; chapter workspace uses `190px minmax(0, 1fr) 280px` at desktop widths. Orange appears only on the primary next action, warning state, and active save error. Use `prefers-reduced-motion` to disable nonessential transitions.

- [ ] **Step 4: Implement safe start and stop scripts**

`Start-Harness.ps1` performs these checks in order: Node major is 24 or higher, `node_modules` exists, database backup succeeds when an existing database is present, migrations succeed, content validation succeeds, production build succeeds, port 3000 is free, then starts `node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3000` hidden. It writes PID and ISO start time to `.runtime/server.json` and opens `http://127.0.0.1:3000`.

If `node_modules` is absent, the script stops with `请先在项目目录运行 npm.cmd install。` rather than silently downloading packages. The two `.cmd` wrappers contain only:

```bat
@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Start-Harness.ps1"
if errorlevel 1 pause
```

and the same command with `Stop-Harness.ps1`, so the user can double-click a stable entry point without changing the machine-wide PowerShell policy.

`Stop-Harness.ps1` resolves the runtime file inside the project, loads PID and start time, confirms the running process start time matches, stops only that process, and removes the runtime file. If it does not match, it exits with an explanatory error and does not stop anything.

The critical start boundary is:

```powershell
$projectRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$runtimeDir = Join-Path $projectRoot '.runtime'
$serverFile = Join-Path $runtimeDir 'server.json'
$nodePath = (Get-Command node -ErrorAction Stop).Source
$nodeMajor = [int]((& $nodePath -p 'process.versions.node.split(".")[0]').Trim())
if ($nodeMajor -lt 24) { throw '需要 Node.js 24 或更高版本。' }
if (Get-NetTCPConnection -LocalAddress '127.0.0.1' -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue) {
  throw '本机端口 3000 已被占用。'
}
Push-Location $projectRoot
try {
  if (Test-Path -LiteralPath 'data\harness.sqlite') { & npm.cmd run db:backup; if ($LASTEXITCODE) { throw '备份失败。' } }
  & npm.cmd run db:migrate; if ($LASTEXITCODE) { throw '数据库迁移失败。' }
  & npm.cmd run content:validate; if ($LASTEXITCODE) { throw '课程内容校验失败。' }
  & npm.cmd run build; if ($LASTEXITCODE) { throw '网站构建失败。' }
  New-Item -ItemType Directory -Path $runtimeDir -Force | Out-Null
  $process = Start-Process -FilePath $nodePath -ArgumentList @(
    'node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', '3000'
  ) -WorkingDirectory $projectRoot -WindowStyle Hidden -PassThru
  @{ pid = $process.Id; startTime = $process.StartTime.ToUniversalTime().ToString('O') } |
    ConvertTo-Json | Set-Content -LiteralPath $serverFile -Encoding utf8
  Start-Process 'http://127.0.0.1:3000'
} finally { Pop-Location }
```

The stopper compares UTC start times within one second before `Stop-Process -Id $record.pid`; it refuses to act if `.runtime/server.json` resolves outside the project or the identity check fails.

- [ ] **Step 5: Verify launch safety, build, and visual constraints**

Run:

```powershell
npm.cmd test -- tests/unit/launch-script.test.ts
npm.cmd run lint
npm.cmd run build
```

Expected: tests pass, no lint errors, and successful build.

- [ ] **Step 6: Manually start and stop the local site**

Run:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/Start-Harness.ps1
powershell -ExecutionPolicy Bypass -File scripts/Stop-Harness.ps1
```

Expected: browser opens the localhost site; `.runtime/server.json` exists while running and is removed after stopping; no LAN address is used.

- [ ] **Step 7: Commit styling and launchers**

```powershell
git add app src/components scripts/Start-Harness.ps1 scripts/Stop-Harness.ps1 scripts/Start-Harness.cmd scripts/Stop-Harness.cmd tests/unit/launch-script.test.ts readme.md
git commit -m "feat: polish life-system UI and local launch"
```

---

### Task 11: Prove the Complete Personal Growth Flow End to End

**Files:**
- Create: `playwright.config.ts`
- Create: `tests/e2e/personal-growth-flow.spec.ts`
- Create: `tests/e2e/no-source-media.spec.ts`
- Create: `scripts/seed-e2e-content.ts`
- Modify: `package.json`
- Modify: `readme.md`

**Interfaces:**
- E2E uses `HARNESS_DB_PATH=data/e2e.sqlite` and a test-only published chapter fixture injected through `HARNESS_CONTENT_FIXTURE=published-chapter`.
- E2E runs serially because all browser actions target one local SQLite database.
- Tests never modify `data/harness.sqlite`.

- [ ] **Step 1: Write the full acceptance test before wiring the fixture**

```ts
// tests/e2e/personal-growth-flow.spec.ts
test("turns one chapter into a reviewed Artifact and recommends the next chapter", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: /开始第01章/ }).click();
  await page.getByLabel("我的现实问题").fill("我在内容创作时不断切换方向");
  await expect(page.getByText("已保存")).toBeVisible();
  await page.getByRole("button", { name: "完成本章学习" }).click();
  await page.getByLabel("我要解决的现实问题").fill("减少内容创作中的目标切换");
  await page.getByLabel("行动").fill("每次只推进一个内容主题");
  await page.getByLabel("成功标准").fill("连续三次完成当天最重要的内容成果");
  await page.getByRole("button", { name: "保存行动计划" }).click();
  await page.getByRole("button", { name: "创建 Artifact" }).click();
  await page.getByRole("button", { name: "开始实践" }).click();
  await page.getByRole("button", { name: "可以复盘" }).click();
  await page.getByLabel("实际发生了什么").fill("完成率提高，但消息处理仍然打断下午工作");
  await page.getByLabel("什么有效、什么没有").fill("单任务有效，消息窗口过长");
  await page.getByLabel("下一版本只改一件什么事").fill("每个消息窗口限制为25分钟");
  await page.getByRole("button", { name: "完成复盘并生成 v2" }).click();
  await expect(page.getByText("v2")).toBeVisible();
  await page.goto("/");
  await expect(page.getByText(/下一步/)).toBeVisible();
});
```

- [ ] **Step 2: Add the media-exclusion test**

```ts
test("does not expose original audio or transcript UI", async ({ page }) => {
  await page.goto("/chapters/chapter-01");
  await expect(page.locator("audio, video")).toHaveCount(0);
  await expect(page.getByText(/逐字稿|下载音频/)).toHaveCount(0);
});
```

- [ ] **Step 3: Run E2E and verify fixture/setup failure**

Run: `npm.cmd run test:e2e -- tests/e2e/personal-growth-flow.spec.ts`

Expected: FAIL because the isolated fixture database and published test content are not wired.

- [ ] **Step 4: Configure an isolated serial Playwright server**

`playwright.config.ts` sets `workers: 1`, starts `npm.cmd run dev`, passes the two test environment variables, and uses `http://127.0.0.1:3000`. `scripts/seed-e2e-content.ts` removes only the resolved `data/e2e.sqlite` after confirming it is inside the project `data` directory, migrates it, and never touches the real database.

Wire test content without changing production records:

```ts
// content/chapters/registry.ts
export function getChapters(): readonly ChapterDefinition[] {
  if (process.env.HARNESS_E2E === "1" && process.env.HARNESS_CONTENT_FIXTURE === "published-chapter") {
    return [publishedChapterFixture, ...awaitingChapters.slice(1)];
  }
  return productionChapters;
}
```

Keep the fixture import inside `content/chapters/registry.ts`; the double environment guard prevents normal operation from selecting it. Configure Playwright setup as:

```ts
export default defineConfig({
  workers: 1,
  use: { baseURL: "http://127.0.0.1:3000" },
  webServer: {
    command: "npm.cmd run dev",
    url: "http://127.0.0.1:3000",
    env: {
      HARNESS_DB_PATH: "data/e2e.sqlite",
      HARNESS_CONTENT_FIXTURE: "published-chapter",
      HARNESS_E2E: "1",
    },
    reuseExistingServer: false,
  },
});
```

Before the first E2E run, install only Chromium:

```powershell
npx.cmd playwright install chromium
```

- [ ] **Step 5: Run the complete verification matrix**

Run:

```powershell
npm.cmd run content:validate
npm.cmd test
npm.cmd run lint
npm.cmd run build
npm.cmd run test:e2e
```

Expected:

- content validator reports 18 valid chapter records;
- all unit and integration tests pass;
- lint has zero errors;
- production build succeeds;
- Playwright passes the full growth flow and source-media exclusion test.

- [ ] **Step 6: Perform the desktop visual check**

Start the app, inspect `/`, `/chapters`, `/chapters/chapter-01` under the test fixture, and `/system` at 1440×900. Verify no horizontal overflow, the reading column stays at or below 72 characters, the right action summary remains visible, save errors are legible, and keyboard focus is visible.

- [ ] **Step 7: Document the verified daily workflow**

Update `readme.md` with:

1. double-click or run `Start-Harness.ps1`;
2. learn and save locally;
3. run `Stop-Harness.ps1` when desired;
4. use `db:backup` before each approved chapter release;
5. use the guarded restore command if recovery is necessary;
6. provide each remaining chapter audio for the approved content workflow.

- [ ] **Step 8: Commit phase-one acceptance**

```powershell
git add playwright.config.ts tests/e2e scripts/seed-e2e-content.ts package.json package-lock.json readme.md
git commit -m "test: verify personal growth system end to end"
```

---

## Final Release Gate

Before declaring phase one complete:

- [ ] Run `git status --short` and confirm only intentionally untracked user files remain.
- [ ] Run `npm.cmd run content:validate` and confirm all 18 records validate.
- [ ] Run `npm.cmd test` and confirm zero failed tests.
- [ ] Run `npm.cmd run lint` and confirm zero errors.
- [ ] Run `npm.cmd run build` and confirm successful production output.
- [ ] Run `npm.cmd run test:e2e` and confirm the learning-to-review flow passes.
- [ ] Create a real backup, restore it to a temporary database, and compare response and Artifact counts.
- [ ] Start and stop the app using the PowerShell launchers.
- [ ] Verify the app listens only on `127.0.0.1`.
- [ ] Verify no original audio, transcript, authentication, community, upload, calendar, streak, score, or notification UI exists.
- [ ] Review the diff against the approved design specification and reject unrelated features.

## References Used for the Technical Baseline

- Next.js 16 requires Node.js 20.9 or later and supports Windows; this project deliberately sets a higher Node.js 24.14 floor for native SQLite: <https://nextjs.org/docs/app/getting-started/installation>
- Node's `node:sqlite` provides `DatabaseSync` and the online `backup()` API used by the plan: <https://nodejs.org/download/release/latest-v24.x/docs/api/sqlite.html>
- Vitest 4 supports Node.js 20+ and explicit one-shot `vitest run`: <https://v4.vitest.dev/guide/>
