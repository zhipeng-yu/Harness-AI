import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { afterEach, describe, expect, it } from "vitest";
import { actionPlanRepository } from "@/src/features/actions/repository";
import { progressRepository } from "@/src/features/progress/repository";
import { responseRepository } from "@/src/features/responses/repository";
import { openDatabase, withTransaction } from "@/src/lib/db/connection";
import { migrate } from "@/src/lib/db/migrate";

const databases: DatabaseSync[] = [];

function openTestDatabase(path = ":memory:") {
  const db = openDatabase(path);
  databases.push(db);
  return db;
}

afterEach(() => {
  while (databases.length > 0) {
    databases.pop()?.close();
  }
});

describe("SQLite persistence", () => {
  it("keeps a prompt response after the database is reopened", () => {
    const path = join(mkdtempSync(join(tmpdir(), "harness-db-")), "test.sqlite");
    let db = openTestDatabase(path);
    migrate(db);
    responseRepository(db).upsert({
      ownerId: "owner-local",
      chapterId: "chapter-01",
      promptId: "chapter-01-reflection-01",
      value: "我在内容创作中频繁切换目标。",
    });
    db.close();
    databases.pop();

    db = openTestDatabase(path);
    expect(
      responseRepository(db).get(
        "owner-local",
        "chapter-01",
        "chapter-01-reflection-01",
      )?.value,
    ).toBe("我在内容创作中频繁切换目标。");
  });

  it("applies the initial migration only once", () => {
    const db = openTestDatabase();

    expect(migrate(db)).toEqual(["001_initial.sql"]);
    expect(migrate(db)).toEqual([]);
    expect(
      db.prepare("SELECT id FROM schema_migrations ORDER BY id").all(),
    ).toEqual([{ id: "001_initial.sql" }]);
  });

  it("rolls back every write when transaction work fails", () => {
    const db = openTestDatabase();
    migrate(db);

    expect(() =>
      withTransaction(db, () => {
        db.prepare(
          "INSERT INTO responses (owner_id, chapter_id, prompt_id, value, updated_at) VALUES (?, ?, ?, ?, ?)",
        ).run("owner-local", "chapter-01", "prompt-01", "partial", "2026-08-13T00:00:00.000Z");
        throw new Error("stop");
      }),
    ).toThrow("stop");
    expect(db.prepare("SELECT * FROM responses").all()).toEqual([]);
  });

  it("enforces the exact learning and artifact status sets", () => {
    const db = openTestDatabase();
    migrate(db);

    expect(() =>
      db.prepare(
        "INSERT INTO chapter_progress (owner_id, chapter_id, learning_stage, updated_at) VALUES (?, ?, ?, ?)",
      ).run("owner-local", "chapter-01", "finished", "2026-08-13T00:00:00.000Z"),
    ).toThrow();
    expect(() =>
      db.prepare(
        "INSERT INTO artifacts (id, owner_id, chapter_id, title, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      ).run(
        "artifact-01",
        "owner-local",
        "chapter-01",
        "Test",
        "published",
        "2026-08-13T00:00:00.000Z",
        "2026-08-13T00:00:00.000Z",
      ),
    ).toThrow();
  });

  it("keeps progress reads and writes scoped to their owner", () => {
    const db = openTestDatabase();
    migrate(db);
    db.prepare("INSERT INTO owners (id, display_name, created_at) VALUES (?, ?, ?)").run(
      "owner-other",
      "Other",
      "2026-08-13T00:00:00.000Z",
    );
    const repository = progressRepository(db);

    expect(repository.setLearningStage("owner-local", "chapter-01", "understanding"))
      .toEqual({ learningStage: "understanding", updatedAt: expect.any(String) });
    repository.setLearningStage("owner-other", "chapter-01", "learned");

    expect(repository.get("owner-local", "chapter-01")?.learningStage).toBe("understanding");
    expect(repository.listForOwner("owner-local")).toHaveLength(1);
    expect(repository.listForOwner("owner-local")[0]?.ownerId).toBe("owner-local");
  });

  it("keeps response reads and upserts scoped to their owner", () => {
    const db = openTestDatabase();
    migrate(db);
    db.prepare("INSERT INTO owners (id, display_name, created_at) VALUES (?, ?, ?)").run(
      "owner-other",
      "Other",
      "2026-08-13T00:00:00.000Z",
    );
    const repository = responseRepository(db);
    const input = {
      chapterId: "chapter-01",
      promptId: "chapter-01-reflection-01",
    };

    expect(repository.upsert({ ownerId: "owner-local", ...input, value: "mine" }))
      .toEqual({ updatedAt: expect.any(String) });
    repository.upsert({ ownerId: "owner-other", ...input, value: "theirs" });

    expect(repository.get("owner-local", input.chapterId, input.promptId)?.value).toBe("mine");
    expect(repository.get("owner-other", input.chapterId, input.promptId)?.value).toBe("theirs");
  });

  it("upserts one action plan per owner and chapter", () => {
    const db = openTestDatabase();
    migrate(db);
    const repository = actionPlanRepository(db);

    const created = repository.upsert({
      ownerId: "owner-local",
      chapterId: "chapter-01",
      problem: "Too many priorities",
      action: "Choose one outcome",
      successCriteria: "One outcome shipped",
    });
    const updated = repository.upsert({
      ownerId: "owner-local",
      chapterId: "chapter-01",
      problem: "Too many priorities",
      action: "Choose one outcome each morning",
      successCriteria: "One outcome shipped",
    });

    expect(updated.id).toBe(created.id);
    expect(repository.get("owner-local", "chapter-01")).toMatchObject({
      ownerId: "owner-local",
      chapterId: "chapter-01",
      action: "Choose one outcome each morning",
      successCriteria: "One outcome shipped",
    });
    expect(repository.get("owner-other", "chapter-01")).toBeUndefined();
  });
});
