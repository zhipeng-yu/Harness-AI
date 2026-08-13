import type { DatabaseSync } from "node:sqlite";
import { afterEach, describe, expect, it } from "vitest";
import { responseRepository } from "@/src/features/responses/repository";
import { openDatabase } from "@/src/lib/db/connection";
import { migrate } from "@/src/lib/db/migrate";

let db: DatabaseSync | undefined;

afterEach(() => {
  db?.close();
  db = undefined;
});

describe("content updates", () => {
  it("keeps an answer when chapter display text changes but IDs stay stable", () => {
    db = openDatabase(":memory:");
    migrate(db);
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
      responseRepository(db).get(
        "owner-local",
        "chapter-01",
        originalPromptId,
      )?.value,
    ).toBe("我的真实回答");
  });
});
