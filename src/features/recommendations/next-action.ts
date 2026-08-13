import type { LearningStage, NextAction } from "@/src/types/learning";

export type RecommendationInput = Readonly<{
  publishedChapterIds: readonly string[];
  progress: readonly Readonly<{
    chapterId: string;
    learningStage: LearningStage;
  }>[];
  actionChapterIds: readonly string[];
  artifactChapterIds: readonly string[];
  reviewReadyArtifactIds: readonly string[];
}>;

export function recommendNextAction(
  input: RecommendationInput,
): NextAction | null {
  const progress = new Map(
    input.progress.map((item) => [item.chapterId, item.learningStage]),
  );
  const actions = new Set(input.actionChapterIds);
  const artifacts = new Set(input.artifactChapterIds);

  for (const chapterId of input.publishedChapterIds) {
    if (progress.get(chapterId) === "understanding") {
      return { kind: "continue_learning", chapterId };
    }
  }

  for (const chapterId of input.publishedChapterIds) {
    if (progress.get(chapterId) === "learned" && !actions.has(chapterId)) {
      return { kind: "plan_action", chapterId };
    }
  }

  for (const chapterId of input.publishedChapterIds) {
    if (actions.has(chapterId) && !artifacts.has(chapterId)) {
      return { kind: "create_artifact", chapterId };
    }
  }

  const artifactId = input.reviewReadyArtifactIds[0];
  if (artifactId) return { kind: "review_artifact", artifactId };

  for (const chapterId of input.publishedChapterIds) {
    if (!progress.has(chapterId)) {
      return { kind: "start_chapter", chapterId };
    }
  }

  return null;
}
