import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { PUT } from "@/app/api/responses/route";
import { responseRepository } from "@/src/features/responses/repository";
import { openDatabase } from "@/src/lib/db/connection";

function responseRequest(body: unknown) {
  return new Request("http://localhost/api/responses", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function usePublishedFixture() {
  const databasePath = join(mkdtempSync(join(tmpdir(), "harness-responses-")), "test.sqlite");
  process.env.HARNESS_DB_PATH = databasePath;
  process.env.HARNESS_E2E = "1";
  process.env.HARNESS_CONTENT_FIXTURE = "published-chapter";
  return databasePath;
}

afterEach(() => {
  delete process.env.HARNESS_DB_PATH;
  delete process.env.HARNESS_E2E;
  delete process.env.HARNESS_CONTENT_FIXTURE;
});

describe("PUT /api/responses", () => {
  it.each([
    ["an empty body", ""],
    ["truncated JSON", '{"chapterId":"chapter-01"'],
  ])("rejects %s", async (_case, body) => {
    const response = await PUT(
      new Request("http://localhost/api/responses", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body,
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "invalid_response" });
  });

  it.each([
    { chapterId: "chapter-19", promptId: "chapter-19-reflection-01", value: "回答" },
    { chapterId: "chapter-01", value: "回答" },
    { chapterId: "chapter-01", promptId: "chapter-01-reflection-01", value: 42 },
  ])("rejects invalid input %#", async (body) => {
    const response = await PUT(responseRequest(body));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "invalid_response" });
  });

  it.each([
    ["an unpublished chapter", "chapter-02", "chapter-02-reflection-01"],
    ["a foreign prompt", "chapter-01", "chapter-01-reflection-99"],
    ["an artifact field", "chapter-01", "chapter-01-artifact-problem"],
  ])("rejects %s", async (_case, chapterId, promptId) => {
    usePublishedFixture();
    const response = await PUT(responseRequest({ chapterId, promptId, value: "回答" }));

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "prompt_not_published" });
  });

  it.each([
    "chapter-01-reflection-01",
    "chapter-01-action-01",
    "chapter-01-review-01",
  ])("writes the published %s prompt for the fixed local owner", async (promptId) => {
    const databasePath = usePublishedFixture();
    const response = await PUT(
      responseRequest({
        chapterId: "chapter-01",
        promptId,
        value: `saved:${promptId}`,
        ownerId: "owner-other",
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ updatedAt: expect.any(String) });

    const db = openDatabase(databasePath);
    try {
      expect(responseRepository(db).get("owner-local", "chapter-01", promptId)?.value).toBe(
        `saved:${promptId}`,
      );
      expect(responseRepository(db).get("owner-other", "chapter-01", promptId)).toBeUndefined();
    } finally {
      db.close();
    }
  });
});
