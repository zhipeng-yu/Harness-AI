import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { chapter01 } from "@/content/chapters/chapter-01";
import { chapter02 } from "@/content/chapters/chapter-02";
import { chapter03 } from "@/content/chapters/chapter-03";
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

  it.each([chapter01, chapter02, chapter03])("keeps every paragraph, concept, scenario and misconception in $id", (chapter) => {
    const slides = buildChapterSlides(chapter);
    const displayed = slides.flatMap(slide => [slide.lead, ...(slide.items ?? []).flatMap(item => [item.title, item.summary])]);
    for (const text of [
      ...chapter.coreStructure.map(item => item.body),
      ...chapter.explanation.map(item => item.body),
      ...chapter.concepts.map(item => item.meaning),
      ...chapter.scenarios,
      ...chapter.misconceptions,
    ]) expect(displayed).toContain(text);
    expect(slides.filter(slide => slide.eyebrow === "深入理解")).toHaveLength(chapter.explanation.length);
  });

  it("jumps to a complete article from the directory and enters practice from the last page", () => {
    const onEnterPractice = vi.fn();
    render(<ChapterDeck chapter={chapter01} onEnterPractice={onEnterPractice} />);
    const slides = buildChapterSlides(chapter01);
    const articleIndex = slides.findIndex(slide => slide.eyebrow === "深入理解");
    const directory = screen.getByRole("combobox", { name: "阅读目录" });
    fireEvent.change(directory, { target: { value: String(articleIndex) } });
    for (const paragraph of chapter01.explanation[0].body.split("\n\n")) {
      expect(screen.getByText(paragraph)).toBeInTheDocument();
    }
    fireEvent.keyDown(directory, { key: "ArrowRight" });
    expect(directory).toHaveValue(String(articleIndex));
    fireEvent.change(directory, { target: { value: String(slides.length - 1) } });
    fireEvent.click(screen.getByRole("button", { name: "进入实践" }));
    expect(onEnterPractice).toHaveBeenCalledOnce();
  });

  it("publishes chapter 02 with its own visuals and scenarios", () => {
    expect(chapterSchema.safeParse(chapter02).success).toBe(true);
    expect(getChapterBySlug("chapter-02")?.status).toBe("published");
    render(<ChapterDeck chapter={chapter02} onEnterPractice={vi.fn()} />);
    expect(screen.getByRole("img").getAttribute("src")).toContain("/chapter-02/");
    const next = screen.getByRole("button", { name: /下一页/ });
    const scenarioIndex = buildChapterSlides(chapter02).findIndex(slide => slide.eyebrow === "落到日常");
    for (let index = 0; index < scenarioIndex; index += 1) fireEvent.click(next);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("把协作语感用在真实任务中");
    expect(screen.getByRole("img").getAttribute("src")).toContain("/chapter-02/");
  });

  it("publishes the complete third chapter with its own visuals and three-day practice", () => {
    expect(chapterSchema.safeParse(chapter03).success).toBe(true);
    expect(getChapterBySlug("chapter-03")).toEqual(chapter03);
    const slides = buildChapterSlides(chapter03);
    expect(slides).toHaveLength(51);
    const enterPractice = vi.fn();
    render(<ChapterDeck chapter={chapter03} onEnterPractice={enterPractice} />);
    const directory = screen.getByRole("combobox", { name: "阅读目录" });
    const scenario = slides.findIndex(slide => slide.eyebrow === "落到日常");
    fireEvent.change(directory, { target: { value: String(scenario) } });
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("把分工与判断用在真实任务中");
    expect(screen.getByRole("img").getAttribute("src")).toContain("/chapter-03/");
    fireEvent.change(directory, { target: { value: String(slides.length - 1) } });
    expect(screen.getByText(chapter03.actionPrompt.question)).toBeInTheDocument();
    expect(screen.getByRole("img").getAttribute("src")).toContain("three-days.svg");
    fireEvent.click(screen.getByRole("button", { name: "进入实践" }));
    expect(enterPractice).toHaveBeenCalledOnce();
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

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(publishedChapterFixture.coreStructure[0].title);
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
