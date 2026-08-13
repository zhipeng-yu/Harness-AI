import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { publishedChapterFixture } from "@/content/fixtures/e2e-published-chapter";
import { ChapterWorkspace } from "@/src/components/chapter-workspace";

const progressResponse = {
  ok: true,
  json: async () => ({
    learningStage: "understanding",
    updatedAt: "2026-08-13T00:00:00.000Z",
  }),
};

describe("ChapterWorkspace", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(progressResponse));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows the six stages and the chapter's real problem", () => {
    render(
      <ChapterWorkspace
        chapter={publishedChapterFixture}
        learningStage="not_started"
        savedResponses={{}}
        actionPlan={null}
        artifact={null}
      />,
    );

    expect(screen.getAllByRole("listitem")).toHaveLength(6);
    expect(screen.getByText(publishedChapterFixture.problem)).toBeInTheDocument();
  });

  it("renders saved reflection responses as editable autosave fields", () => {
    const prompt = publishedChapterFixture.reflectionPrompts[0];
    render(
      <ChapterWorkspace
        chapter={publishedChapterFixture}
        learningStage="understanding"
        savedResponses={{ [prompt.id]: "已经保存的回答" }}
        actionPlan={null}
        artifact={null}
      />,
    );

    expect(screen.getByRole("textbox", { name: prompt.question })).toHaveValue(
      "已经保存的回答",
    );
  });

  it("records understanding once when a chapter has no progress", async () => {
    render(
      <ChapterWorkspace
        chapter={publishedChapterFixture}
        learningStage="not_started"
        savedResponses={{}}
        actionPlan={null}
        artifact={null}
      />,
    );

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    expect(fetch).toHaveBeenCalledWith("/api/progress", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chapterId: "chapter-01",
        learningStage: "understanding",
      }),
    });
  });

  it("marks learning complete only after the explicit completion action", async () => {
    render(
      <ChapterWorkspace
        chapter={publishedChapterFixture}
        learningStage="understanding"
        savedResponses={{}}
        actionPlan={null}
        artifact={null}
      />,
    );

    expect(fetch).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "完成本章学习" }));

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    expect(fetch).toHaveBeenCalledWith("/api/progress", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chapterId: "chapter-01",
        learningStage: "learned",
      }),
    });
  });
});
