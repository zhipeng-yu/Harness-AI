import type { ArtifactEvent, ArtifactStatus } from "@/src/types/learning";

const transitions: Record<
  ArtifactStatus,
  Partial<Record<ArtifactEvent, ArtifactStatus>>
> = {
  draft: { start_practice: "in_practice", archive: "archived" },
  in_practice: { mark_review_ready: "review_ready", archive: "archived" },
  review_ready: { submit_review: "reviewed", archive: "archived" },
  reviewed: { create_next_version: "draft", archive: "archived" },
  archived: {},
};

export function transitionArtifact(
  current: ArtifactStatus,
  event: ArtifactEvent,
): ArtifactStatus {
  const next = transitions[current][event];
  if (!next) {
    throw new Error(`Illegal artifact transition: ${current} -> ${event}`);
  }
  return next;
}
