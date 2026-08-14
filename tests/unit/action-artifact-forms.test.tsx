import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { publishedChapterFixture } from "@/content/fixtures/e2e-published-chapter";
import { ActionPlanForm } from "@/src/components/action-plan-form";
import { ArtifactEditor } from "@/src/components/artifact-editor";
import { ArtifactReviewForm } from "@/src/components/artifact-review-form";
import { ChapterWorkspace } from "@/src/components/chapter-workspace";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fixed action and Artifact forms", () => {
  it("saves exactly the three action-plan text fields", async () => {
    const saved = {
      id: "action-01",
      ownerId: "owner-local",
      chapterId: "chapter-01",
      problem: "Server problem",
      action: "Server action",
      successCriteria: "Server success",
      createdAt: "2026-08-13T00:00:00.000Z",
      updatedAt: "2026-08-13T00:00:00.000Z",
    };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => saved }),
    );
    const onSaved = vi.fn();
    const { container } = render(
      <ActionPlanForm
        chapterId="chapter-01"
        actionPrompt={publishedChapterFixture.actionPrompt}
        initialValue={null}
        onSaved={onSaved}
      />,
    );

    expect(screen.getAllByRole("textbox")).toHaveLength(3);
    expect(container.querySelector('input[type="file"], input[type="url"]')).toBeNull();
    fireEvent.change(screen.getByRole("textbox", { name: "现实问题" }), {
      target: { value: "Client problem" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "行动" }), {
      target: { value: "Client action" },
    });
    fireEvent.change(
      screen.getByRole("textbox", { name: "可观察的成功标准" }),
      { target: { value: "Client success" } },
    );
    fireEvent.click(screen.getByRole("button", { name: "保存行动计划" }));

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(saved));
    expect(screen.getByRole("textbox", { name: "现实问题" })).toHaveValue(
      "Server problem",
    );
    expect(fetch).toHaveBeenCalledWith("/api/action-plans", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chapterId: "chapter-01",
        problem: "Client problem",
        action: "Client action",
        successCriteria: "Client success",
      }),
    });
  });

  it("creates an Artifact from exactly four version text fields", async () => {
    const saved = {
      id: "artifact-01",
      title: "Focus system",
      status: "draft",
      currentVersion: 1,
    };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => saved }),
    );
    const onCreated = vi.fn();
    const { container } = render(
      <ArtifactEditor
        chapterId="chapter-01"
        title="Focus system"
        fields={publishedChapterFixture.artifactTemplate.fields}
        onCreated={onCreated}
      />,
    );

    expect(screen.getAllByRole("textbox")).toHaveLength(4);
    expect(container.querySelector('input[type="file"], input[type="url"]')).toBeNull();
    fireEvent.change(
      screen.getByRole("textbox", { name: "要解决的现实问题" }),
      { target: { value: "Problem" } },
    );
    fireEvent.change(
      screen.getByRole("textbox", { name: "从课程采用的核心原则" }),
      { target: { value: "Principles" } },
    );
    fireEvent.change(screen.getByRole("textbox", { name: "运行规则" }), {
      target: { value: "Rules" },
    });
    fireEvent.change(
      screen.getByRole("textbox", { name: "可观察的成功标准" }),
      { target: { value: "Success" } },
    );
    fireEvent.click(screen.getByRole("button", { name: "创建 Artifact" }));

    await waitFor(() => expect(onCreated).toHaveBeenCalledWith(saved));
    expect(fetch).toHaveBeenCalledWith("/api/artifacts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chapterId: "chapter-01",
        title: "Focus system",
        problem: "Problem",
        principles: "Principles",
        rules: "Rules",
        successCriteria: "Success",
      }),
    });
  });

  it("submits exactly three review text fields and the chosen server action", async () => {
    const saved = { status: "draft", version: 2 };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => saved }),
    );
    const onSaved = vi.fn();
    const { container } = render(
      <ArtifactReviewForm
        artifactId="artifact-01"
        prompts={publishedChapterFixture.reviewPrompts}
        onSaved={onSaved}
      />,
    );

    expect(screen.getAllByRole("textbox")).toHaveLength(3);
    expect(container.querySelector('input[type="file"], input[type="url"]')).toBeNull();
    fireEvent.change(
      screen.getByRole("textbox", { name: publishedChapterFixture.reviewPrompts[0].question }),
      { target: { value: "Actual" } },
    );
    fireEvent.change(
      screen.getByRole("textbox", { name: publishedChapterFixture.reviewPrompts[1].question }),
      { target: { value: "Effective" } },
    );
    fireEvent.change(
      screen.getByRole("textbox", { name: publishedChapterFixture.reviewPrompts[2].question }),
      { target: { value: "Next change" } },
    );
    fireEvent.click(
      screen.getByRole("button", { name: "完成复盘并创建下一版本" }),
    );

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(saved));
    expect(fetch).toHaveBeenCalledWith("/api/artifacts/artifact-01", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event: "submit_review",
        actualResult: "Actual",
        effective: "Effective",
        nextChange: "Next change",
        createNextVersion: true,
      }),
    });
  });

  it("uses stable review prompt ids and questions in fixed storage order", () => {
    render(
      <ArtifactReviewForm
        artifactId="artifact-01"
        prompts={publishedChapterFixture.reviewPrompts}
        onSaved={vi.fn()}
      />,
    );

    for (const prompt of publishedChapterFixture.reviewPrompts) {
      expect(screen.getByRole("textbox", { name: prompt.question })).toHaveAttribute(
        "id",
        prompt.id,
      );
    }
  });

  it("uses the lifecycle state returned by the server", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ status: "review_ready", version: 1 }),
      }),
    );
    render(
      <ChapterWorkspace
        chapter={publishedChapterFixture}
        learningStage="understanding"
        savedResponses={{}}
        actionPlan={null}
        artifact={{
          id: "artifact-01",
          title: "Focus system",
          status: "draft",
          currentVersion: 1,
        }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "开始实践" }));

    await waitFor(() =>
      expect(
        screen.getByRole("textbox", { name: publishedChapterFixture.reviewPrompts[0].question }),
      ).toBeInTheDocument(),
    );
  });
});
