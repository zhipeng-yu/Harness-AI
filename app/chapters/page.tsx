import type { DatabaseSync } from "node:sqlite";
import { getChapters } from "@/content/chapters/registry";
import { ChapterMap } from "@/src/components/chapter-map";
import { progressRepository } from "@/src/features/progress/repository";
import { openDatabase } from "@/src/lib/db/connection";
import { migrate } from "@/src/lib/db/migrate";
import { OWNER_ID } from "@/src/lib/owner";

export const dynamic = "force-dynamic";

type ArtifactChapterSummary = {
  chapter_id: string;
  status: string;
};

export default function ChaptersPage() {
  let db: DatabaseSync | undefined;

  try {
    db = openDatabase();
    migrate(db);

    const progress = progressRepository(db).listForOwner(OWNER_ID);
    const actionChapterIds = db
      .prepare("SELECT chapter_id FROM action_plans WHERE owner_id = ? ORDER BY chapter_id")
      .all(OWNER_ID)
      .map((row) => String(row.chapter_id));
    const artifactRows = db
      .prepare("SELECT chapter_id, status FROM artifacts WHERE owner_id = ? ORDER BY created_at")
      .all(OWNER_ID) as ArtifactChapterSummary[];

    return (
      <main className="page page--chapters">
        <h1>18 章成长地图</h1>
        <p>推荐顺序不会锁定导航，你可以随时查看任何已发布章节。</p>
        <ChapterMap
          chapters={getChapters()}
          progress={progress}
          actionChapterIds={actionChapterIds}
          artifactChapterIds={artifactRows.map((artifact) => artifact.chapter_id)}
          reviewReadyChapterIds={artifactRows
            .filter((artifact) => artifact.status === "review_ready")
            .map((artifact) => artifact.chapter_id)}
          reviewedChapterIds={artifactRows
            .filter((artifact) => artifact.status === "reviewed")
            .map((artifact) => artifact.chapter_id)}
        />
      </main>
    );
  } finally {
    db?.close();
  }
}
