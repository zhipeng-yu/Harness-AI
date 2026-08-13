import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SystemModuleCard } from "@/src/components/system-module-card";
import type { Artifact } from "@/src/features/artifacts/repository";

const reviewedArtifactFixture: Artifact = {
  id: "artifact-focus",
  ownerId: "owner-local",
  chapterId: "chapter-13",
  title: "专注沟通系统",
  status: "reviewed",
  currentVersion: 2,
  createdAt: "2026-08-11T08:00:00.000Z",
  updatedAt: "2026-08-13T08:00:00.000Z",
  archivedAt: null,
  versions: [
    {
      id: "version-1",
      artifactId: "artifact-focus",
      version: 1,
      problem: "消息打断专注",
      principles: "集中处理消息",
      rules: "每天两个消息窗口",
      successCriteria: "完成三段专注工作",
      revisionNote: "",
      createdAt: "2026-08-11T08:00:00.000Z",
    },
    {
      id: "version-2",
      artifactId: "artifact-focus",
      version: 2,
      problem: "消息打断专注",
      principles: "集中处理消息",
      rules: "每天两个消息窗口",
      successCriteria: "完成三段专注工作",
      revisionNote: "窗口固定在上午和下午",
      createdAt: "2026-08-12T08:00:00.000Z",
    },
  ],
  reviews: [
    {
      id: "review-2",
      artifactId: "artifact-focus",
      artifactVersionId: "version-2",
      actualResult: "消息处理更集中",
      effective: "固定窗口有效",
      nextChange: "消息窗口限制为15分钟",
      createdAt: "2026-08-13T08:00:00.000Z",
    },
  ],
};

describe("SystemModuleCard", () => {
  it("shows current version, state, source chapter, and next change", () => {
    render(<SystemModuleCard module={reviewedArtifactFixture} />);

    expect(screen.getByText("v2")).toBeInTheDocument();
    expect(screen.getByText("已复盘")).toBeInTheDocument();
    expect(screen.getByText("第13章")).toBeInTheDocument();
    expect(screen.getByText("消息窗口限制为15分钟")).toBeInTheDocument();
  });
});
