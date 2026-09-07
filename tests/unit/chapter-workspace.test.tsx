import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { chapter01 } from "@/content/chapters/chapter-01";
import { chapter02Draft } from "@/content/drafts/chapter-02";
import { chapterSchema } from "@/content/schema";
import { getChapterBySlug } from "@/content/chapters/registry";
import { publishedChapterFixture } from "@/content/fixtures/published-chapter";
import { buildChapterSlides, ChapterDeck } from "@/src/components/chapter-deck";
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
        learningStage="understanding"
        savedResponses={{}}
        actionPlan={null}
        artifact={null}
      />,
    );

    expect(screen.getByRole("navigation", { name: "章节学习阶段" }).querySelectorAll("li"))
      .toHaveLength(6);
    expect(screen.getByText(publishedChapterFixture.problem)).toBeInTheDocument();
  });

  it("turns the full first chapter into an 18-slide deck", () => {
    expect(buildChapterSlides(chapter01)).toHaveLength(18);
  });

  it("keeps chapter 02 unpublished while its draft uses its own visuals and scenarios", () => {
    expect(chapterSchema.safeParse(chapter02Draft).success).toBe(true);
    expect(getChapterBySlug("chapter-02")?.status).toBe("awaiting_audio");
    render(<ChapterDeck chapter={chapter02Draft} onEnterPractice={vi.fn()} />);
    expect(screen.getByRole("img").getAttribute("src")).toContain("/chapter-02/");
    const next = screen.getByRole("button", { name: /下一页/ });
    const scenarioIndex = buildChapterSlides(chapter02Draft).findIndex(slide => slide.eyebrow === "落到日常");
    for (let index = 0; index < scenarioIndex; index += 1) fireEvent.click(next);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("把协作语感用在真实任务中");
    expect(screen.getByRole("img").getAttribute("src")).toContain("/chapter-02/");
  });

  it("supports keyboard paging", () => {
    render(
      <ChapterWorkspace
        chapter={publishedChapterFixture}
        learningStage="understanding"
        savedResponses={{}}
        actionPlan={null}
        artifact={null}
      />,
    );

    fireEvent.keyDown(window, { key: "ArrowRight" });

    expect(screen.getByText(publishedChapterFixture.coreStructure[0].title)).toBeInTheDocument();
    expect(screen.getByText("2 / 8")).toBeInTheDocument();
  });

  it("pages through concepts, scenarios and misconceptions", () => {
    render(
      <ChapterWorkspace
        chapter={publishedChapterFixture}
        learningStage="understanding"
        savedResponses={{}}
        actionPlan={null}
        artifact={null}
      />,
    );

    const next = screen.getByRole("button", { name: /下一页/ });
    for (let index = 0; index < 4; index += 1) fireEvent.click(next);

    expect(screen.getByText(publishedChapterFixture.concepts[0].term)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "展开完整讲义" })).not.toBeInTheDocument();
    fireEvent.click(next);
    expect(screen.getByText(publishedChapterFixture.scenarios[0])).toBeInTheDocument();
    fireEvent.click(next);
    expect(screen.getByText(publishedChapterFixture.misconceptions[0])).toBeInTheDocument();
  });

  it("binds stable course prompt and field ids to the fixed forms", () => {
    render(
      <ChapterWorkspace
        chapter={publishedChapterFixture}
        learningStage="understanding"
        savedResponses={{}}
        actionPlan={null}
        artifact={null}
      />,
    );

    expect(screen.getByText(publishedChapterFixture.actionPrompt.question)).toHaveAttribute(
      "id",
      publishedChapterFixture.actionPrompt.id,
    );
    for (const field of publishedChapterFixture.artifactTemplate.fields) {
      expect(document.getElementById(field.id)).toHaveAccessibleName(field.label);
    }
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
