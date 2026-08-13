import { recommendNextAction } from "@/src/features/recommendations/next-action";

it("prefers unfinished learning over later work", () => {
  const result = recommendNextAction({
    publishedChapterIds: ["chapter-01", "chapter-02"],
    progress: [{ chapterId: "chapter-01", learningStage: "understanding" }],
    actionChapterIds: ["chapter-02"],
    artifactChapterIds: [],
    reviewReadyArtifactIds: ["artifact-01"],
  });

  expect(result).toEqual({
    kind: "continue_learning",
    chapterId: "chapter-01",
  });
});

it("recommends an action plan after learning is complete", () => {
  const result = recommendNextAction({
    publishedChapterIds: ["chapter-01", "chapter-02"],
    progress: [{ chapterId: "chapter-01", learningStage: "learned" }],
    actionChapterIds: ["chapter-02"],
    artifactChapterIds: [],
    reviewReadyArtifactIds: ["artifact-02"],
  });

  expect(result).toEqual({ kind: "plan_action", chapterId: "chapter-01" });
});

it("recommends creating an Artifact for a planned chapter", () => {
  const result = recommendNextAction({
    publishedChapterIds: ["chapter-01"],
    progress: [{ chapterId: "chapter-01", learningStage: "learned" }],
    actionChapterIds: ["chapter-01"],
    artifactChapterIds: [],
    reviewReadyArtifactIds: ["artifact-01"],
  });

  expect(result).toEqual({
    kind: "create_artifact",
    chapterId: "chapter-01",
  });
});

it("recommends the first review-ready Artifact after chapter work", () => {
  const result = recommendNextAction({
    publishedChapterIds: ["chapter-01", "chapter-02"],
    progress: [{ chapterId: "chapter-01", learningStage: "learned" }],
    actionChapterIds: ["chapter-01"],
    artifactChapterIds: ["chapter-01"],
    reviewReadyArtifactIds: ["artifact-02", "artifact-03"],
  });

  expect(result).toEqual({
    kind: "review_artifact",
    artifactId: "artifact-02",
  });
});

it("recommends the first published chapter with no progress", () => {
  const input = {
    publishedChapterIds: ["chapter-01", "chapter-03"],
    progress: [
      { chapterId: "chapter-01", learningStage: "learned" as const },
      { chapterId: "chapter-02", learningStage: "understanding" as const },
    ],
    actionChapterIds: ["chapter-01", "chapter-02"],
    artifactChapterIds: ["chapter-01", "chapter-02"],
    reviewReadyArtifactIds: [],
  };

  expect(recommendNextAction(input)).toEqual({
    kind: "start_chapter",
    chapterId: "chapter-03",
  });
});

it("returns null when there are no published chapters", () => {
  expect(
    recommendNextAction({
      publishedChapterIds: [],
      progress: [{ chapterId: "chapter-02", learningStage: "understanding" }],
      actionChapterIds: ["chapter-02"],
      artifactChapterIds: [],
      reviewReadyArtifactIds: [],
    }),
  ).toBeNull();
});

it("does not mutate its inputs", () => {
  const input = {
    publishedChapterIds: Object.freeze(["chapter-01", "chapter-02"]),
    progress: Object.freeze([
      Object.freeze({
        chapterId: "chapter-01",
        learningStage: "learned" as const,
      }),
    ]),
    actionChapterIds: Object.freeze(["chapter-01"]),
    artifactChapterIds: Object.freeze<string[]>([]),
    reviewReadyArtifactIds: Object.freeze<string[]>([]),
  };
  const before = structuredClone(input);

  recommendNextAction(input);

  expect(input).toEqual(before);
});
