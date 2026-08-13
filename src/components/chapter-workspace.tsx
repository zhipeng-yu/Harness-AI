"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ChapterDefinition } from "@/content/schema";
import type { ActionPlan } from "@/src/features/actions/repository";
import type { ArtifactStatus, LearningStage } from "@/src/types/learning";
import { ActionPlanForm } from "./action-plan-form";
import { ArtifactEditor } from "./artifact-editor";
import { ArtifactReviewForm, isArtifactState } from "./artifact-review-form";
import { AutosaveField } from "./autosave-field";
import { ProgressStepper } from "./progress-stepper";

type PublishedChapter = Extract<ChapterDefinition, { status: "published" }>;

export type ArtifactSummary = Readonly<{
  id: string;
  title: string;
  status: ArtifactStatus;
  currentVersion: number;
}>;

type ChapterWorkspaceProps = Readonly<{
  chapter: PublishedChapter;
  learningStage: LearningStage;
  savedResponses: Readonly<Record<string, string>>;
  actionPlan: ActionPlan | null;
  artifact: ArtifactSummary | null;
}>;

export function ChapterWorkspace({
  chapter,
  learningStage: initialLearningStage,
  savedResponses,
  actionPlan,
  artifact,
}: ChapterWorkspaceProps) {
  const [learningStage, setLearningStage] = useState(initialLearningStage);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [savedActionPlan, setSavedActionPlan] = useState(actionPlan);
  const [currentArtifact, setCurrentArtifact] = useState(artifact);
  const [artifactSaving, setArtifactSaving] = useState(false);
  const [artifactError, setArtifactError] = useState(false);
  const opened = useRef(false);

  const saveProgress = useCallback(async (nextStage: "understanding" | "learned") => {
    setSaving(true);
    setSaveError(false);

    try {
      const response = await fetch("/api/progress", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chapterId: chapter.id, learningStage: nextStage }),
      });
      if (!response.ok) throw new Error("progress_not_saved");
      const saved = (await response.json()) as { learningStage: LearningStage };
      setLearningStage(saved.learningStage);
    } catch {
      setSaveError(true);
    } finally {
      setSaving(false);
    }
  }, [chapter.id]);

  useEffect(() => {
    if (initialLearningStage !== "not_started" || opened.current) return;
    opened.current = true;
    void saveProgress("understanding");
  }, [initialLearningStage, saveProgress]);

  const updateArtifactState = useCallback(
    async (
      event: "start_practice" | "mark_review_ready" | "create_next_version" | "archive",
    ) => {
      if (!currentArtifact) return;
      setArtifactSaving(true);
      setArtifactError(false);
      try {
        const response = await fetch(`/api/artifacts/${currentArtifact.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ event }),
        });
        if (!response.ok) throw new Error("artifact_transition_failed");
        const payload: unknown = await response.json();
        if (!isArtifactState(payload)) throw new Error("invalid_artifact_state");
        setCurrentArtifact((previous) =>
          previous
            ? { ...previous, status: payload.status, currentVersion: payload.version }
            : previous,
        );
      } catch {
        setArtifactError(true);
      } finally {
        setArtifactSaving(false);
      }
    },
    [currentArtifact],
  );

  const acceptArtifactState = useCallback(
    (state: { status: ArtifactStatus; version: number }) => {
      setCurrentArtifact((previous) =>
        previous
          ? { ...previous, status: state.status, currentVersion: state.version }
          : previous,
      );
    },
    [],
  );

  return (
    <main className="chapter-workspace">
      <aside className="chapter-workspace__stages">
        <ProgressStepper learningStage={learningStage} />
      </aside>

      <article className="chapter-workspace__content">
        <p>第 {chapter.order} 章</p>
        <h1>{chapter.title}</h1>
        <section>
          <h2>本章要解决的问题</h2>
          <p>{chapter.problem}</p>
          <p>{chapter.oneSentence}</p>
        </section>

        <section>
          <h2>理解系统</h2>
          {chapter.coreStructure.map((item) => (
            <div key={item.title}>
              <h3>{item.title}</h3>
              <p>{item.body}</p>
            </div>
          ))}
          {chapter.explanation.map((item) => (
            <div key={item.heading}>
              <h3>{item.heading}</h3>
              <p>{item.body}</p>
            </div>
          ))}
        </section>

        <section>
          <h2>照见自己</h2>
          {chapter.reflectionPrompts.map((prompt) => (
            <AutosaveField
              key={prompt.id}
              chapterId={chapter.id}
              promptId={prompt.id}
              label={prompt.question}
              initialValue={savedResponses[prompt.id] ?? ""}
            />
          ))}
        </section>

        <section>
          <h2>行动设计</h2>
          <ActionPlanForm
            chapterId={chapter.id}
            initialValue={savedActionPlan}
            onSaved={setSavedActionPlan}
          />
        </section>

        <section>
          <h2>创建 Artifact</h2>
          {!currentArtifact ? (
            <ArtifactEditor
              chapterId={chapter.id}
              title={chapter.artifactTemplate.title}
              onCreated={setCurrentArtifact}
            />
          ) : (
            <div>
              <p>{currentArtifact.title}</p>
              <p>版本 {currentArtifact.currentVersion}</p>
              <p>{currentArtifact.status}</p>
              {currentArtifact.status === "draft" ? (
                <button
                  type="button"
                  disabled={artifactSaving}
                  onClick={() => void updateArtifactState("start_practice")}
                >
                  开始实践
                </button>
              ) : null}
              {currentArtifact.status === "in_practice" ? (
                <button
                  type="button"
                  disabled={artifactSaving}
                  onClick={() => void updateArtifactState("mark_review_ready")}
                >
                  标记为可以复盘
                </button>
              ) : null}
              {currentArtifact.status === "review_ready" ? (
                <ArtifactReviewForm
                  artifactId={currentArtifact.id}
                  onSaved={acceptArtifactState}
                />
              ) : null}
              {currentArtifact.status === "reviewed" ? (
                <button
                  type="button"
                  disabled={artifactSaving}
                  onClick={() => void updateArtifactState("create_next_version")}
                >
                  创建下一版本
                </button>
              ) : null}
              {currentArtifact.status !== "archived" ? (
                <button
                  type="button"
                  disabled={artifactSaving}
                  onClick={() => void updateArtifactState("archive")}
                >
                  归档 Artifact
                </button>
              ) : null}
              {artifactError ? (
                <p role="alert">Artifact 状态更新失败，请重试。</p>
              ) : null}
            </div>
          )}
        </section>

        <button
          type="button"
          disabled={saving || learningStage === "learned"}
          onClick={() => void saveProgress("learned")}
        >
          {learningStage === "learned" ? "已完成本章学习" : "完成本章学习"}
        </button>
        {saveError ? <p role="alert">进度保存失败，请重试。</p> : null}
      </article>

      <aside className="chapter-workspace__summary" aria-label="行动与产物摘要">
        <h2>行动摘要</h2>
        {savedActionPlan ? (
          <div>
            <p>{savedActionPlan.action}</p>
            <p>成功标准：{savedActionPlan.successCriteria}</p>
          </div>
        ) : (
          <p>尚未制定行动</p>
        )}
        <h2>Artifact 摘要</h2>
        {currentArtifact ? (
          <div>
            <p>{currentArtifact.title}</p>
            <p>版本 {currentArtifact.currentVersion}</p>
            <p>{currentArtifact.status}</p>
          </div>
        ) : (
          <p>尚未创建 Artifact</p>
        )}
      </aside>
    </main>
  );
}
