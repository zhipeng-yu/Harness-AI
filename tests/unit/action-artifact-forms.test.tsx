import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { publishedChapterFixture } from "@/content/fixtures/published-chapter";
import { ActionPlanForm } from "@/src/components/action-plan-form";
import { ArtifactEditor, artifactPlanLabels } from "@/src/components/artifact-editor";
import { ArtifactReviewForm } from "@/src/components/artifact-review-form";
import { ChapterWorkspace } from "@/src/components/chapter-workspace";
import type { Artifact } from "@/src/features/artifacts/repository";

const artifactVersion = {
  id: "version-01",
  artifactId: "artifact-01",
  version: 1,
  problem: "Server problem",
  principles: "Server principles",
  rules: "Server rules",
  successCriteria: "Server success",
  revisionNote: "",
  createdAt: "2026-08-13T00:00:00.000Z",
};

function artifactFixture(
  overrides: Partial<Artifact> = {},
): Artifact {
  return {
    id: "artifact-01",
    ownerId: "owner-local",
    chapterId: "chapter-01",
    title: "Focus system",
    status: "draft",
    currentVersion: 1,
    createdAt: "2026-08-13T00:00:00.000Z",
    updatedAt: "2026-08-13T00:00:00.000Z",
    archivedAt: null,
    versions: [artifactVersion],
    reviews: [],
    ...overrides,
  };
}

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

  it("creates a practice plan without asking for results in advance", async () => {
    const saved = artifactFixture();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => saved }),
    );
    const onSaved = vi.fn();
    const { container } = render(
      <ArtifactEditor
        chapterId="chapter-01"
        title="Focus system"
        fields={publishedChapterFixture.artifactTemplate.fields}
        onSaved={onSaved}
      />,
    );

    expect(screen.getAllByRole("textbox")).toHaveLength(2);
    expect(container.querySelector('input[type="file"], input[type="url"]')).toBeNull();
    fireEvent.change(
      screen.getByRole("textbox", { name: artifactPlanLabels[0] }),
      { target: { value: "Problem" } },
    );
    fireEvent.change(
      screen.getByRole("textbox", { name: artifactPlanLabels[1] }),
      { target: { value: "Principles" } },
    );
    fireEvent.click(screen.getByRole("button", { name: "保存实践计划" }));

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(saved));
    expect(fetch).toHaveBeenCalledWith("/api/artifacts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chapterId: "chapter-01",
        title: "Focus system",
        problem: "Problem",
        principles: "Principles",
        rules: "",
        successCriteria: "",
      }),
    });
  });

  it("prefills and saves an editable Artifact draft", async () => {
    const saved = artifactFixture({
      versions: [{ ...artifactVersion, problem: "Updated problem" }],
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => saved }),
    );
    const onSaved = vi.fn();
    render(
      <ArtifactEditor
        chapterId="chapter-01"
        title="Focus system"
        fields={publishedChapterFixture.artifactTemplate.fields}
        artifactId="artifact-01"
        version={artifactVersion}
        onSaved={onSaved}
      />,
    );

    expect(
      screen.getByRole("textbox", { name: artifactPlanLabels[0] }),
    ).toHaveValue("Server problem");
    fireEvent.change(
      screen.getByRole("textbox", { name: artifactPlanLabels[0] }),
      { target: { value: "Updated problem" } },
    );
    expect(screen.getAllByRole("textbox")).toHaveLength(2);
    expect(screen.getByText("Server rules")).toBeInTheDocument();
    expect(screen.getByText("Server success")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "保存实践计划" }));

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(saved));
    expect(fetch).toHaveBeenCalledWith("/api/artifacts/artifact-01", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event: "save_draft",
        problem: "Updated problem",
        principles: "Server principles",
        rules: "Server rules",
        successCriteria: "Server success",
      }),
    });
  });

  it("submits exactly three review text fields and the chosen server action", async () => {
    const saved = artifactFixture({
      currentVersion: 2,
      versions: [
        artifactVersion,
        { ...artifactVersion, id: "version-02", version: 2 },
      ],
    });
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
        json: async () =>
          artifactFixture({ status: "review_ready" }),
      }),
    );
    render(
      <ChapterWorkspace
        chapter={publishedChapterFixture}
        learningStage="understanding"
        savedResponses={{}}
        actionPlan={null}
        artifact={artifactFixture()}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "开始实践并锁定 v1" }),
    );

    await waitFor(() =>
      expect(
        screen.getByRole("textbox", { name: publishedChapterFixture.reviewPrompts[0].question }),
      ).toBeInTheDocument(),
    );
  });

  it("prefills the single practice plan from an existing action design", () => {
    const actionPlan = {
      id: "action-01", ownerId: "owner-local", chapterId: "chapter-01",
      problem: "Existing goal", action: "Existing action", successCriteria: "Existing standard",
      createdAt: artifactVersion.createdAt, updatedAt: artifactVersion.createdAt,
    };
    render(<ChapterWorkspace chapter={publishedChapterFixture}
      learningStage="learned" savedResponses={{}} actionPlan={actionPlan} artifact={null} />);

    expect(screen.getByRole("textbox", { name: artifactPlanLabels[0] })).toHaveValue("Existing goal");
    expect(screen.getByRole("textbox", { name: artifactPlanLabels[1] })).toHaveValue(
      "Existing action\n\n成功标准：Existing standard",
    );
    expect(screen.queryByRole("button", { name: "保存行动计划" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "保存实践计划" })).toHaveLength(1);
    expect(screen.queryByRole("heading", { name: "实践后：记录结果与复盘" })).not.toBeInTheDocument();
  });

  it("shows the review form only after practice ends and retains the submitted review", async () => {
    const review = {
      id: "review-01", artifactId: "artifact-01", artifactVersionId: artifactVersion.id,
      actualResult: "Finished three days", effective: "A useful habit", nextChange: "Simplify next time",
      createdAt: artifactVersion.createdAt,
    };
    const request = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => artifactFixture({ status: "review_ready" }) })
      .mockResolvedValueOnce({ ok: true, json: async () => artifactFixture({ status: "reviewed", reviews: [review] }) });
    vi.stubGlobal("fetch", request);
    render(<ChapterWorkspace chapter={publishedChapterFixture}
      learningStage="learned" savedResponses={{}} actionPlan={null}
      artifact={artifactFixture({ status: "in_practice" })} />);

    expect(screen.queryByRole("textbox", { name: publishedChapterFixture.reviewPrompts[0].question })).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: artifactPlanLabels[0] })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "实践结束，填写结果与复盘" }));
    await screen.findByRole("heading", { name: "实践后：记录结果与复盘" });
    const values = [review.actualResult, review.effective, review.nextChange];
    publishedChapterFixture.reviewPrompts.forEach((prompt, index) => {
      fireEvent.change(screen.getByRole("textbox", { name: prompt.question }), { target: { value: values[index] } });
    });
    fireEvent.click(screen.getByRole("button", { name: "完成复盘" }));
    await screen.findByText("实际结果：Finished three days");
    expect(screen.getByText("有效做法：A useful habit")).toBeInTheDocument();
    expect(screen.getByText("下一步变更：Simplify next time")).toBeInTheDocument();
    expect(request).toHaveBeenLastCalledWith("/api/artifacts/artifact-01", expect.objectContaining({
      body: JSON.stringify({ event: "submit_review", actualResult: review.actualResult,
        effective: review.effective, nextChange: review.nextChange, createNextVersion: false }),
    }));
  });
});
