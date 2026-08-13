import Link from "next/link";
import type { ChapterDefinition } from "@/content/schema";
import type { LearningStage } from "@/src/types/learning";

type ChapterProgressSummary = Readonly<{
  chapterId: string;
  learningStage: LearningStage;
}>;

export function ChapterMap({
  chapters,
  progress = [],
  actionChapterIds = [],
  artifactChapterIds = [],
  reviewReadyChapterIds = [],
  reviewedChapterIds = [],
}: Readonly<{
  chapters: readonly ChapterDefinition[];
  progress?: readonly ChapterProgressSummary[];
  actionChapterIds?: readonly string[];
  artifactChapterIds?: readonly string[];
  reviewReadyChapterIds?: readonly string[];
  reviewedChapterIds?: readonly string[];
}>) {
  const progressByChapter = new Map(
    progress.map((item) => [item.chapterId, item.learningStage]),
  );
  const actions = new Set(actionChapterIds);
  const artifacts = new Set(artifactChapterIds);
  const reviewReady = new Set(reviewReadyChapterIds);
  const reviewed = new Set(reviewedChapterIds);

  return (
    <ol className="chapter-map" aria-label="18 章成长地图">
      {chapters.map((chapter) => {
        if (chapter.status === "awaiting_audio") {
          return (
            <li key={chapter.id}>
              <strong>{chapter.title}</strong>
              <p>等待完整音频</p>
            </li>
          );
        }

        let status = "尚未开始";
        if (progressByChapter.get(chapter.id) === "understanding") {
          status = "学习中";
        }
        if (progressByChapter.get(chapter.id) === "learned") {
          status = "已完成学习";
        }
        if (actions.has(chapter.id)) status = "已制定行动";
        if (artifacts.has(chapter.id)) status = "已创建 Artifact";
        if (reviewReady.has(chapter.id)) status = "等待复盘";
        if (reviewed.has(chapter.id)) status = "已实践并复盘";

        return (
          <li key={chapter.id}>
            <Link href={`/chapters/${chapter.slug}`}>{chapter.title}</Link>
            <p>{status}</p>
          </li>
        );
      })}
    </ol>
  );
}
