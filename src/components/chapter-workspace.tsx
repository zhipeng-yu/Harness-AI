"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ChapterDefinition } from "@/content/schema";
import type { ActionPlan } from "@/src/features/actions/repository";
import type {
  Artifact,
  ArtifactVersion,
} from "@/src/features/artifacts/repository";
import type { LearningStage } from "@/src/types/learning";
import { ActionPlanForm } from "./action-plan-form";
import { ArtifactEditor, isArtifactPayload } from "./artifact-editor";
import { ArtifactReviewForm } from "./artifact-review-form";
import { ArtifactVersionHistory } from "./artifact-version-history";
import { AutosaveField } from "./autosave-field";
import { ChapterDeck } from "./chapter-deck";
import { ProgressStepper } from "./progress-stepper";
import { artifactStatusLabels } from "./system-module-card";

type PublishedChapter = Extract<ChapterDefinition, { status: "published" }>;

export type ArtifactSummary = Artifact;

type ChapterWorkspaceProps = Readonly<{
  chapter: PublishedChapter;
  learningStage: LearningStage;
  savedResponses: Readonly<Record<string, string>>;
  actionPlan: ActionPlan | null;
  artifact: ArtifactSummary | null;
}>;

function ArtifactVersionContent({
  fields,
  version,
}: Readonly<{
  fields: PublishedChapter["artifactTemplate"]["fields"];
  version: ArtifactVersion;
}>) {
  const values = [
    version.problem,
    version.principles,
    version.rules,
    version.successCriteria,
  ];
  return (
    <dl className="artifact-content">
      {fields.map((field, index) => (
        <div key={field.id}>
          <dt>{field.label}</dt>
          <dd>{values[index]}</dd>
        </div>
      ))}
    </dl>
  );
}

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
  const practiceStart = useRef<HTMLElement>(null);

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
        if (!isArtifactPayload(payload)) throw new Error("invalid_artifact_state");
        setCurrentArtifact(payload);
      } catch {
        setArtifactError(true);
      } finally {
        setArtifactSaving(false);
      }
    },
    [currentArtifact],
  );

  const enterPractice = useCallback(() => {
    practiceStart.current?.focus({ preventScroll: true });
    practiceStart.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);
  const currentVersion = currentArtifact?.versions.find(
    (version) => version.version === currentArtifact.currentVersion,
  );

  return (
    <main className="chapter-workspace">
      <div className="chapter-workspace__learning">
        <ChapterDeck chapter={chapter} onEnterPractice={enterPractice} />
      </div>

      <aside className="chapter-workspace__stages">
        <ProgressStepper learningStage={learningStage} />
      </aside>

      <article
        ref={practiceStart}
        className="chapter-workspace__content"
        tabIndex={-1}
        aria-label="章节实践工作区"
      >
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
            actionPrompt={chapter.actionPrompt}
            initialValue={savedActionPlan}
            onSaved={setSavedActionPlan}
          />
        </section>

        <section>
          <h2>实践成果卡（Artifact）</h2>
          <p>
            它把本章方法变成一轮可检查的实践。草稿可以修改；点击开始实践后，
            当前版本会锁定，等真实结果回来再复盘并生成下一版。
          </p>
          {!currentArtifact ? (
            <ArtifactEditor
              chapterId={chapter.id}
              title={chapter.artifactTemplate.title}
              fields={chapter.artifactTemplate.fields}
              onSaved={setCurrentArtifact}
            />
          ) : currentVersion ? (
            <div className="artifact-workflow">
              <h3>{currentArtifact.title}</h3>
              <p>
                v{currentArtifact.currentVersion} · {artifactStatusLabels[currentArtifact.status]}
              </p>
              {currentArtifact.status === "draft" ? (
                <ArtifactEditor
                  key={`${currentArtifact.id}-${currentArtifact.currentVersion}`}
                  chapterId={chapter.id}
                  title={currentArtifact.title}
                  fields={chapter.artifactTemplate.fields}
                  artifactId={currentArtifact.id}
                  version={currentVersion}
                  onSaved={setCurrentArtifact}
                />
              ) : (
                <ArtifactVersionContent
                  fields={chapter.artifactTemplate.fields}
                  version={currentVersion}
                />
              )}
              {currentArtifact.status === "draft" ? (
                <div>
                  <p>修改后请先保存草稿，再开始实践。</p>
                  <button
                    type="button"
                    disabled={artifactSaving}
                    onClick={() => void updateArtifactState("start_practice")}
                  >
                    开始实践并锁定 v{currentArtifact.currentVersion}
                  </button>
                </div>
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
                  prompts={chapter.reviewPrompts}
                  onSaved={setCurrentArtifact}
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
              {currentArtifact.versions.length > 1 || currentArtifact.reviews.length > 0 ? (
                <ArtifactVersionHistory
                  versions={currentArtifact.versions}
                  reviews={currentArtifact.reviews}
                  fieldLabels={[
                    chapter.artifactTemplate.fields[0].label,
                    chapter.artifactTemplate.fields[1].label,
                    chapter.artifactTemplate.fields[2].label,
                    chapter.artifactTemplate.fields[3].label,
                  ]}
                />
              ) : null}
              {artifactError ? (
                <p role="alert">实践成果卡状态更新失败，请重试。</p>
              ) : null}
            </div>
          ) : (
            <p role="alert">找不到当前版本，请刷新页面重试。</p>
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
        <h2>实践成果卡</h2>
        {currentArtifact ? (
          <div>
            <p>{currentArtifact.title}</p>
            <p>版本 {currentArtifact.currentVersion}</p>
            <p>{artifactStatusLabels[currentArtifact.status]}</p>
          </div>
        ) : (
          <p>尚未创建实践成果卡</p>
        )}
      </aside>
    </main>
  );
}
