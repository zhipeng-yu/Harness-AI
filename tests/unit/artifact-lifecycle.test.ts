import { describe, expect, it } from "vitest";
import { transitionArtifact } from "@/src/features/artifacts/lifecycle";
import type { ArtifactEvent, ArtifactStatus } from "@/src/types/learning";

const legalTransitions = [
  ["draft", "start_practice", "in_practice"],
  ["draft", "archive", "archived"],
  ["in_practice", "mark_review_ready", "review_ready"],
  ["in_practice", "archive", "archived"],
  ["review_ready", "submit_review", "reviewed"],
  ["review_ready", "archive", "archived"],
  ["reviewed", "create_next_version", "draft"],
  ["reviewed", "archive", "archived"],
] satisfies [ArtifactStatus, ArtifactEvent, ArtifactStatus][];

const statuses: ArtifactStatus[] = [
  "draft",
  "in_practice",
  "review_ready",
  "reviewed",
  "archived",
];
const events: ArtifactEvent[] = [
  "start_practice",
  "mark_review_ready",
  "submit_review",
  "create_next_version",
  "archive",
];
const legalPairs = new Set(
  legalTransitions.map(([status, event]) => `${status}:${event}`),
);
const illegalTransitions = statuses.flatMap((status) =>
  events
    .filter((event) => !legalPairs.has(`${status}:${event}`))
    .map((event) => [status, event] as const),
);

describe("Artifact lifecycle", () => {
  it.each(legalTransitions)(
    "moves %s via %s to %s",
    (from, event, expected) => {
      expect(transitionArtifact(from, event)).toBe(expected);
    },
  );

  it.each(illegalTransitions)("rejects %s via %s", (from, event) => {
    expect(() => transitionArtifact(from, event)).toThrow(
      `Illegal artifact transition: ${from} -> ${event}`,
    );
  });
});
