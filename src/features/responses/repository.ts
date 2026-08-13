import type { DatabaseSync } from "node:sqlite";

export type PromptResponse = {
  ownerId: string;
  chapterId: string;
  promptId: string;
  value: string;
  updatedAt: string;
};

type ResponseRow = {
  owner_id: string;
  chapter_id: string;
  prompt_id: string;
  value: string;
  updated_at: string;
};

function mapResponse(row: ResponseRow): PromptResponse {
  return {
    ownerId: row.owner_id,
    chapterId: row.chapter_id,
    promptId: row.prompt_id,
    value: row.value,
    updatedAt: row.updated_at,
  };
}

export function responseRepository(db: DatabaseSync) {
  const getStatement = db.prepare(
    "SELECT owner_id, chapter_id, prompt_id, value, updated_at FROM responses WHERE owner_id = ? AND chapter_id = ? AND prompt_id = ?",
  );
  const upsertStatement = db.prepare(`
    INSERT INTO responses (owner_id, chapter_id, prompt_id, value, updated_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT (owner_id, chapter_id, prompt_id) DO UPDATE SET
      value = excluded.value,
      updated_at = excluded.updated_at
    WHERE responses.owner_id = excluded.owner_id
  `);

  return {
    get(
      ownerId: string,
      chapterId: string,
      promptId: string,
    ): PromptResponse | undefined {
      const row = getStatement.get(ownerId, chapterId, promptId) as
        | ResponseRow
        | undefined;
      return row ? mapResponse(row) : undefined;
    },

    upsert(input: {
      ownerId: string;
      chapterId: string;
      promptId: string;
      value: string;
    }): { updatedAt: string } {
      const updatedAt = new Date().toISOString();
      upsertStatement.run(
        input.ownerId,
        input.chapterId,
        input.promptId,
        input.value,
        updatedAt,
      );
      return { updatedAt };
    },
  };
}
