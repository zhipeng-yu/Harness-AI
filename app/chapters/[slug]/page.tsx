import type { DatabaseSync } from "node:sqlite";
import { notFound } from "next/navigation";
import { getChapterBySlug } from "@/content/chapters/registry";
import {
  ChapterWorkspace,
  type ArtifactSummary,
} from "@/src/components/chapter-workspace";
import { actionPlanRepository } from "@/src/features/actions/repository";
import { artifactRepository } from "@/src/features/artifacts/repository";
import { progressRepository } from "@/src/features/progress/repository";
import { openDatabase } from "@/src/lib/db/connection";
import { migrate } from "@/src/lib/db/migrate";
import { OWNER_ID } from "@/src/lib/owner";

export const dynamic = "force-dynamic";

type ResponseRow = {
  prompt_id: string;
  value: string;
};

export default async function ChapterPage({
  params,
}: Readonly<{ params: Promise<{ slug: string }> }>) {
  const { slug } = await params;
  const chapter = getChapterBySlug(slug);
  if (!chapter || chapter.status !== "published") notFound();

  let db: DatabaseSync | undefined;
  try {
    db = openDatabase();
    migrate(db);

    const progress = progressRepository(db).get(OWNER_ID, chapter.id);
    const responseRows = db
      .prepare(
        "SELECT prompt_id, value FROM responses WHERE owner_id = ? AND chapter_id = ? ORDER BY prompt_id",
      )
      .all(OWNER_ID, chapter.id) as ResponseRow[];
    const savedResponses = Object.fromEntries(
      responseRows.map((response) => [response.prompt_id, response.value]),
    );
    const actionPlan = actionPlanRepository(db).get(OWNER_ID, chapter.id) ?? null;
    const artifact: ArtifactSummary | null =
      artifactRepository(db).getByChapter(OWNER_ID, chapter.id) ?? null;

    return (
      <ChapterWorkspace
        chapter={chapter}
        learningStage={progress?.learningStage ?? "not_started"}
        savedResponses={savedResponses}
        actionPlan={actionPlan}
        artifact={artifact}
      />
    );
  } finally {
    db?.close();
  }
}
