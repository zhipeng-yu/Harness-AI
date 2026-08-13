import type { Artifact } from "@/src/features/artifacts/repository";
import type { ArtifactStatus } from "@/src/types/learning";
import { ArtifactVersionHistory } from "./artifact-version-history";

export const artifactStatusLabels: Record<ArtifactStatus, string> = {
  draft: "草稿",
  in_practice: "实践中",
  review_ready: "等待复盘",
  reviewed: "已复盘",
  archived: "已归档",
};

function sourceChapter(chapterId: string) {
  const match = /^chapter-(\d+)$/.exec(chapterId);
  return match ? `第${Number(match[1])}章` : chapterId;
}

export function SystemModuleCard({ module: artifact }: Readonly<{ module: Artifact }>) {
  const latestReview = [...artifact.reviews].sort(
    (left, right) =>
      right.createdAt.localeCompare(left.createdAt) ||
      right.id.localeCompare(left.id),
  )[0];

  return (
    <article>
      <h3>{artifact.title}</h3>
      <dl>
        <div>
          <dt>当前版本</dt>
          <dd>v{artifact.currentVersion}</dd>
        </div>
        <div>
          <dt>状态</dt>
          <dd>{artifactStatusLabels[artifact.status]}</dd>
        </div>
        <div>
          <dt>来源</dt>
          <dd>{sourceChapter(artifact.chapterId)}</dd>
        </div>
        <div>
          <dt>下一步变更</dt>
          <dd>{latestReview?.nextChange || "暂无下一步变更"}</dd>
        </div>
      </dl>
      <ArtifactVersionHistory
        versions={artifact.versions}
        reviews={artifact.reviews}
      />
    </article>
  );
}
