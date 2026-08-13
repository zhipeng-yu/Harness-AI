export type LearningStage = "not_started" | "understanding" | "learned";
export type ArtifactStatus =
  | "draft"
  | "in_practice"
  | "review_ready"
  | "reviewed"
  | "archived";
export type ArtifactEvent =
  | "start_practice"
  | "mark_review_ready"
  | "submit_review"
  | "create_next_version"
  | "archive";

export type NextAction =
  | { kind: "continue_learning"; chapterId: string }
  | { kind: "plan_action"; chapterId: string }
  | { kind: "create_artifact"; chapterId: string }
  | { kind: "review_artifact"; artifactId: string }
  | { kind: "start_chapter"; chapterId: string };
