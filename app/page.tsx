import type { DatabaseSync } from "node:sqlite";
import { getChapters, getPublishedChapters } from "@/content/chapters/registry";
import { ChapterMap } from "@/src/components/chapter-map";
import { RecommendationCard } from "@/src/components/recommendation-card";
import { progressRepository } from "@/src/features/progress/repository";
import { recommendNextAction } from "@/src/features/recommendations/next-action";
import { openDatabase } from "@/src/lib/db/connection";
import { migrate } from "@/src/lib/db/migrate";
import { OWNER_ID } from "@/src/lib/owner";
import type { ArtifactStatus } from "@/src/types/learning";

export const dynamic = "force-dynamic";

type ArtifactSummary = {
  id: string;
  chapter_id: string;
  status: ArtifactStatus;
};

export default function HomePage() {
  const chapters = getChapters();
  const publishedChapterIds = getPublishedChapters().map((chapter) => chapter.id);
  const publishedIds = new Set(publishedChapterIds);
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
      .prepare("SELECT id, chapter_id, status FROM artifacts WHERE owner_id = ? ORDER BY created_at")
      .all(OWNER_ID) as ArtifactSummary[];
    const artifactChapterIds = artifactRows.map((artifact) => artifact.chapter_id);
    const reviewReadyArtifacts = artifactRows.filter(
      (artifact) => artifact.status === "review_ready",
    );
    const openActionCount = actionChapterIds.filter(
      (chapterId) => !artifactChapterIds.includes(chapterId),
    ).length;
    const action = recommendNextAction({
      publishedChapterIds,
      progress: progress.filter((item) => publishedIds.has(item.chapterId)),
      actionChapterIds: actionChapterIds.filter((id) => publishedIds.has(id)),
      artifactChapterIds: artifactChapterIds.filter((id) => publishedIds.has(id)),
      reviewReadyArtifactIds: reviewReadyArtifacts
        .filter((artifact) => publishedIds.has(artifact.chapter_id))
        .map((artifact) => artifact.id),
    });

    return (
      <main>
        <h1>超体 · 我的成长操作系统</h1>
        <p>把课程理解转化为行动、创造与复盘。</p>

        <RecommendationCard action={action} chapters={chapters} />

        <section aria-labelledby="open-loop-heading">
          <h2 id="open-loop-heading">尚未形成闭环</h2>
          <dl>
            <div>
              <dt>待创建 Artifact 的行动</dt>
              <dd>{openActionCount}</dd>
            </div>
            <div>
              <dt>Artifacts</dt>
              <dd>{artifactRows.length}</dd>
            </div>
            <div>
              <dt>待复盘</dt>
              <dd>{reviewReadyArtifacts.length}</dd>
            </div>
          </dl>
        </section>

        <section aria-labelledby="chapter-map-heading">
          <h2 id="chapter-map-heading">18 章成长地图</h2>
          <ChapterMap
            chapters={chapters}
            progress={progress}
            actionChapterIds={actionChapterIds}
            artifactChapterIds={artifactChapterIds}
            reviewReadyChapterIds={reviewReadyArtifacts.map(
              (artifact) => artifact.chapter_id,
            )}
            reviewedChapterIds={artifactRows
              .filter((artifact) => artifact.status === "reviewed")
              .map((artifact) => artifact.chapter_id)}
          />
        </section>
      </main>
    );
  } finally {
    db?.close();
  }
}
