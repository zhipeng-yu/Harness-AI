import type { DatabaseSync } from "node:sqlite";
import type { LearningStage } from "@/src/types/learning";

export type ChapterProgress = {
  ownerId: string;
  chapterId: string;
  learningStage: LearningStage;
  updatedAt: string;
};

type ProgressRow = {
  owner_id: string;
  chapter_id: string;
  learning_stage: LearningStage;
  updated_at: string;
};

function mapProgress(row: ProgressRow): ChapterProgress {
  return {
    ownerId: row.owner_id,
    chapterId: row.chapter_id,
    learningStage: row.learning_stage,
    updatedAt: row.updated_at,
  };
}

export function progressRepository(db: DatabaseSync) {
  const getStatement = db.prepare(
    "SELECT owner_id, chapter_id, learning_stage, updated_at FROM chapter_progress WHERE owner_id = ? AND chapter_id = ?",
  );
  const listStatement = db.prepare(
    "SELECT owner_id, chapter_id, learning_stage, updated_at FROM chapter_progress WHERE owner_id = ? ORDER BY chapter_id",
  );
  const upsertStatement = db.prepare(`
    INSERT INTO chapter_progress (owner_id, chapter_id, learning_stage, updated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT (owner_id, chapter_id) DO UPDATE SET
      learning_stage = excluded.learning_stage,
      updated_at = excluded.updated_at
    WHERE chapter_progress.owner_id = excluded.owner_id
  `);

  return {
    get(ownerId: string, chapterId: string): ChapterProgress | undefined {
      const row = getStatement.get(ownerId, chapterId) as ProgressRow | undefined;
      return row ? mapProgress(row) : undefined;
    },

    listForOwner(ownerId: string): ChapterProgress[] {
      return (listStatement.all(ownerId) as ProgressRow[]).map(mapProgress);
    },

    setLearningStage(
      ownerId: string,
      chapterId: string,
      learningStage: LearningStage,
    ): { learningStage: LearningStage; updatedAt: string } {
      const updatedAt = new Date().toISOString();
      upsertStatement.run(ownerId, chapterId, learningStage, updatedAt);
      return { learningStage, updatedAt };
    },
  };
}
