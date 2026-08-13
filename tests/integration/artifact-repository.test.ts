import type { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  ArtifactNotFoundError,
  artifactRepository,
} from "@/src/features/artifacts/repository";
import { openDatabase } from "@/src/lib/db/connection";
import { migrate } from "@/src/lib/db/migrate";

let db: DatabaseSync;

const firstVersion = {
  chapterId: "chapter-01",
  title: "Focus system",
  problem: "Too many priorities",
  principles: "Choose one constraint",
  rules: "One outcome each morning",
  successCriteria: "One meaningful outcome shipped",
};

function createArtifact(ownerId = "owner-local") {
  return artifactRepository(db).createWithVersion({ ownerId, ...firstVersion });
}

function moveToReviewReady(artifactId: string, ownerId = "owner-local") {
  const repository = artifactRepository(db);
  repository.transition(ownerId, artifactId, "start_practice");
  repository.transition(ownerId, artifactId, "mark_review_ready");
}

beforeEach(() => {
  db = openDatabase(":memory:");
  migrate(db);
});

afterEach(() => {
  db.close();
});

describe("Artifact repository", () => {
  it("creates the Artifact and immutable version 1 together", () => {
    const created = createArtifact();

    expect(created).toMatchObject({
      ownerId: "owner-local",
      chapterId: "chapter-01",
      title: "Focus system",
      status: "draft",
      currentVersion: 1,
      versions: [
        {
          version: 1,
          problem: firstVersion.problem,
          principles: firstVersion.principles,
          rules: firstVersion.rules,
          successCriteria: firstVersion.successCriteria,
          revisionNote: "",
        },
      ],
      reviews: [],
    });
    expect(db.prepare("SELECT COUNT(*) AS count FROM artifacts").get()).toEqual({
      count: 1,
    });
    expect(
      db.prepare("SELECT COUNT(*) AS count FROM artifact_versions").get(),
    ).toEqual({ count: 1 });
  });

  it("rolls back the Artifact when creating version 1 fails", () => {
    db.exec(`
      CREATE TRIGGER reject_first_artifact_version
      BEFORE INSERT ON artifact_versions
      BEGIN
        SELECT RAISE(ABORT, 'version rejected');
      END;
    `);

    expect(() => createArtifact()).toThrow("version rejected");
    expect(db.prepare("SELECT COUNT(*) AS count FROM artifacts").get()).toEqual({
      count: 0,
    });
    expect(
      db.prepare("SELECT COUNT(*) AS count FROM artifact_versions").get(),
    ).toEqual({ count: 0 });
  });

  it("scopes chapter reads, owner lists, and transitions to the owner", () => {
    db.prepare(
      "INSERT INTO owners (id, display_name, created_at) VALUES (?, ?, ?)",
    ).run("owner-other", "Other", "2026-08-13T00:00:00.000Z");
    const mine = createArtifact();
    const theirs = createArtifact("owner-other");
    const repository = artifactRepository(db);

    expect(repository.getByChapter("owner-local", "chapter-01")?.id).toBe(
      mine.id,
    );
    expect(repository.listForOwner("owner-local").map((item) => item.id)).toEqual([
      mine.id,
    ]);
    expect(repository.listForOwner("owner-other").map((item) => item.id)).toEqual([
      theirs.id,
    ]);
    expect(() =>
      repository.transition("owner-local", theirs.id, "start_practice"),
    ).toThrow(ArtifactNotFoundError);
    expect(repository.getByChapter("owner-other", "chapter-01")?.status).toBe(
      "draft",
    );
  });

  it("does not write when a transition is illegal", () => {
    const created = createArtifact();
    const before = db
      .prepare(
        "SELECT status, current_version, updated_at FROM artifacts WHERE id = ?",
      )
      .get(created.id);

    expect(() =>
      artifactRepository(db).transition(
        "owner-local",
        created.id,
        "mark_review_ready",
      ),
    ).toThrow("Illegal artifact transition: draft -> mark_review_ready");

    expect(
      db
        .prepare(
          "SELECT status, current_version, updated_at FROM artifacts WHERE id = ?",
        )
        .get(created.id),
    ).toEqual(before);
  });

  it("links a review to the reviewed version without creating a next version", () => {
    const created = createArtifact();
    moveToReviewReady(created.id);

    const result = artifactRepository(db).addReviewAndNextVersion(
      "owner-local",
      created.id,
      {
        actualResult: "Shipped the chosen outcome",
        effective: "Choosing before opening messages",
        nextChange: "Shorten the focus window",
        createNextVersion: false,
      },
    );
    const saved = artifactRepository(db).getByChapter(
      "owner-local",
      "chapter-01",
    )!;

    expect(result).toEqual({ status: "reviewed", version: 1 });
    expect(saved).toMatchObject({ status: "reviewed", currentVersion: 1 });
    expect(saved.versions).toHaveLength(1);
    expect(saved.reviews).toHaveLength(1);
    expect(saved.reviews[0]).toMatchObject({
      artifactVersionId: saved.versions[0]?.id,
      actualResult: "Shipped the chosen outcome",
      effective: "Choosing before opening messages",
      nextChange: "Shorten the focus window",
    });
  });

  it("copies all four immutable fields into the next draft version", () => {
    const created = createArtifact();
    moveToReviewReady(created.id);

    const result = artifactRepository(db).addReviewAndNextVersion(
      "owner-local",
      created.id,
      {
        actualResult: "Shipped the chosen outcome",
        effective: "Choosing before opening messages",
        nextChange: "Shorten the focus window",
        createNextVersion: true,
      },
    );
    const saved = artifactRepository(db).getByChapter(
      "owner-local",
      "chapter-01",
    )!;

    expect(result).toEqual({ status: "draft", version: 2 });
    expect(saved).toMatchObject({ status: "draft", currentVersion: 2 });
    expect(saved.versions).toMatchObject([
      {
        version: 1,
        problem: firstVersion.problem,
        principles: firstVersion.principles,
        rules: firstVersion.rules,
        successCriteria: firstVersion.successCriteria,
        revisionNote: "",
      },
      {
        version: 2,
        problem: firstVersion.problem,
        principles: firstVersion.principles,
        rules: firstVersion.rules,
        successCriteria: firstVersion.successCriteria,
        revisionNote: "Shorten the focus window",
      },
    ]);
    expect(saved.reviews[0]?.artifactVersionId).toBe(saved.versions[0]?.id);
  });

  it("creates the next version later from the reviewed version and saved review", () => {
    const created = createArtifact();
    moveToReviewReady(created.id);
    const repository = artifactRepository(db);
    repository.addReviewAndNextVersion("owner-local", created.id, {
      actualResult: "Shipped the chosen outcome",
      effective: "Choosing before opening messages",
      nextChange: "Shorten the focus window",
      createNextVersion: false,
    });

    const result = repository.transition(
      "owner-local",
      created.id,
      "create_next_version",
    );
    const saved = repository.getByChapter("owner-local", "chapter-01")!;

    expect(result).toEqual({ status: "draft", version: 2 });
    expect(saved).toMatchObject({ status: "draft", currentVersion: 2 });
    expect(saved.versions[1]).toMatchObject({
      version: 2,
      problem: firstVersion.problem,
      principles: firstVersion.principles,
      rules: firstVersion.rules,
      successCriteria: firstVersion.successCriteria,
      revisionNote: "Shorten the focus window",
    });
  });

  it("rolls back the review and status when next-version creation fails", () => {
    const created = createArtifact();
    moveToReviewReady(created.id);
    db.exec(`
      CREATE TRIGGER reject_next_artifact_version
      BEFORE INSERT ON artifact_versions
      WHEN NEW.version > 1
      BEGIN
        SELECT RAISE(ABORT, 'next version rejected');
      END;
    `);

    expect(() =>
      artifactRepository(db).addReviewAndNextVersion(
        "owner-local",
        created.id,
        {
          actualResult: "Shipped the chosen outcome",
          effective: "Choosing before opening messages",
          nextChange: "Shorten the focus window",
          createNextVersion: true,
        },
      ),
    ).toThrow("next version rejected");

    const saved = artifactRepository(db).getByChapter(
      "owner-local",
      "chapter-01",
    )!;
    expect(saved).toMatchObject({ status: "review_ready", currentVersion: 1 });
    expect(saved.versions).toHaveLength(1);
    expect(saved.reviews).toHaveLength(0);
  });
});
