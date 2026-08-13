"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ChapterDefinition } from "@/content/schema";
import type { ActionPlan } from "@/src/features/actions/repository";
import type { ArtifactStatus, LearningStage } from "@/src/types/learning";
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
            <div key={prompt.id}>
              <h3>{prompt.question}</h3>
              <p>{savedResponses[prompt.id] || "尚未回答"}</p>
            </div>
          ))}
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
        {actionPlan ? (
          <div>
            <p>{actionPlan.action}</p>
            <p>成功标准：{actionPlan.successCriteria}</p>
          </div>
        ) : (
          <p>尚未制定行动</p>
        )}
        <h2>Artifact 摘要</h2>
        {artifact ? (
          <div>
            <p>{artifact.title}</p>
            <p>版本 {artifact.currentVersion}</p>
            <p>{artifact.status}</p>
          </div>
        ) : (
          <p>尚未创建 Artifact</p>
        )}
      </aside>
    </main>
  );
}
