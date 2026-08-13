import Link from "next/link";
import type { ChapterDefinition } from "@/content/schema";
import type { NextAction } from "@/src/types/learning";

const actionLabels: Record<Exclude<NextAction["kind"], "review_artifact">, string> = {
  continue_learning: "继续学习",
  plan_action: "制定行动",
  create_artifact: "创建 Artifact",
  start_chapter: "进入本章",
};

export function RecommendationCard({
  action,
  chapters,
}: Readonly<{
  action: NextAction | null;
  chapters: readonly ChapterDefinition[];
}>) {
  if (!action) {
    return (
      <section className="next-action" aria-labelledby="next-action-heading">
        <h2 id="next-action-heading">下一步</h2>
        <p>暂无可推荐的已发布章节。</p>
        <Link href="/chapters">查看 18 章地图</Link>
      </section>
    );
  }

  if (action.kind === "review_artifact") {
    return (
      <section className="next-action" aria-labelledby="next-action-heading">
        <h2 id="next-action-heading">下一步</h2>
        <p>复盘已准备好的 Artifact</p>
        <p>{action.artifactId}</p>
      </section>
    );
  }

  const chapter = chapters.find((item) => item.id === action.chapterId);

  return (
    <section className="next-action" aria-labelledby="next-action-heading">
      <h2 id="next-action-heading">下一步</h2>
      <p>{actionLabels[action.kind]}</p>
      <h3>{chapter?.title ?? action.chapterId}</h3>
      {chapter?.status === "published" ? (
        <Link href={`/chapters/${chapter.slug}`}>打开章节工作台</Link>
      ) : null}
    </section>
  );
}
