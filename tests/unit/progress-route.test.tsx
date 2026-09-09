import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import ChapterPage from "@/app/chapters/[slug]/page";
import { PUT } from "@/app/api/progress/route";
import { progressRepository } from "@/src/features/progress/repository";
import { openDatabase } from "@/src/lib/db/connection";

function progressRequest(body: unknown) {
  return new Request("http://localhost/api/progress", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

afterEach(() => {
  delete process.env.HARNESS_DB_PATH;
  delete process.env.HARNESS_TEST;
  delete process.env.HARNESS_CONTENT_FIXTURE;
});

describe("PUT /api/progress", () => {
  it.each([
    ["an empty body", ""],
    ["truncated JSON", '{"chapterId":"chapter-01"'],
  ])("rejects %s as invalid progress", async (_case, body) => {
    const response = await PUT(
      new Request("http://localhost/api/progress", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body,
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "invalid_progress" });
  });

  it.each([
    { chapterId: "chapter-19", learningStage: "understanding" },
    { chapterId: "chapter-01", learningStage: "not_started" },
  ])("rejects an invalid progress body", async (body) => {
    const response = await PUT(progressRequest(body));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "invalid_progress" });
  });

  it("rejects progress for an awaiting-audio chapter", async () => {
    const response = await PUT(
      progressRequest({ chapterId: "chapter-04", learningStage: "understanding" }),
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "chapter_not_published" });
  });

  it("writes published chapter progress for the fixed local owner", async () => {
    const databasePath = join(mkdtempSync(join(tmpdir(), "harness-progress-")), "test.sqlite");
    process.env.HARNESS_DB_PATH = databasePath;
    process.env.HARNESS_TEST = "1";
    process.env.HARNESS_CONTENT_FIXTURE = "published-chapter";

    const response = await PUT(
      progressRequest({
        chapterId: "chapter-01",
        learningStage: "learned",
        ownerId: "owner-other",
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      learningStage: "learned",
      updatedAt: expect.any(String),
    });
    const db = openDatabase(databasePath);
    try {
      expect(progressRepository(db).get("owner-local", "chapter-01")?.learningStage).toBe(
        "learned",
      );
      expect(progressRepository(db).get("owner-other", "chapter-01")).toBeUndefined();
    } finally {
      db.close();
    }
  });
});

describe("chapter page publication boundary", () => {
  it.each(["does-not-exist", "chapter-04"])("returns 404 for slug %s", async (slug) => {
    await expect(
      ChapterPage({ params: Promise.resolve({ slug }) }),
    ).rejects.toThrow(/404/);
  });
});
