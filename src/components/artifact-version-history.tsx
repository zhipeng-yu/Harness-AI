import type {
  ArtifactReview,
  ArtifactVersion,
} from "@/src/features/artifacts/repository";

type ArtifactVersionHistoryProps = Readonly<{
  versions: ArtifactVersion[];
  reviews: ArtifactReview[];
  fieldLabels?: readonly [string, string, string, string];
}>;

function formatTime(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Shanghai",
  }).format(new Date(value));
}

export function ArtifactVersionHistory({
  versions,
  reviews,
  fieldLabels = ["问题", "原则", "规则", "成功标准"],
}: ArtifactVersionHistoryProps) {
  const chronologicalVersions = [...versions].sort(
    (left, right) =>
      left.createdAt.localeCompare(right.createdAt) ||
      left.version - right.version,
  );

  return (
    <section aria-label="版本历史">
      <h3>版本历史</h3>
      {chronologicalVersions.map((version) => {
        const linkedReviews = reviews.filter(
          (review) => review.artifactVersionId === version.id,
        );

        return (
          <details key={version.id} open={chronologicalVersions.length <= 3}>
            <summary>
              v{version.version} ·{" "}
              <time dateTime={version.createdAt}>
                {formatTime(version.createdAt)}
              </time>
            </summary>
            <dl>
              <div>
                <dt>{fieldLabels[0]}</dt>
                <dd>{version.problem}</dd>
              </div>
              <div>
                <dt>{fieldLabels[1]}</dt>
                <dd>{version.principles}</dd>
              </div>
              <div>
                <dt>{fieldLabels[2]}</dt>
                <dd>{version.rules}</dd>
              </div>
              <div>
                <dt>{fieldLabels[3]}</dt>
                <dd>{version.successCriteria}</dd>
              </div>
              <div>
                <dt>修订说明</dt>
                <dd>{version.revisionNote || "初始版本"}</dd>
              </div>
            </dl>
            <h4>复盘</h4>
            {linkedReviews.length === 0 ? (
              <p>暂无复盘</p>
            ) : (
              linkedReviews.map((review) => (
                <article key={review.id}>
                  <p>
                    复盘时间：
                    <time dateTime={review.createdAt}>
                      {formatTime(review.createdAt)}
                    </time>
                  </p>
                  <p>实际结果：{review.actualResult}</p>
                  <p>有效做法：{review.effective}</p>
                  <p>下一步变更：{review.nextChange}</p>
                </article>
              ))
            )}
          </details>
        );
      })}
    </section>
  );
}
