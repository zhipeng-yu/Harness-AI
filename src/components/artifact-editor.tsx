"use client";

import { useState } from "react";
import type { ChapterDefinition } from "@/content/schema";
import type { ActionPlan } from "@/src/features/actions/repository";
import type {
  Artifact,
  ArtifactVersion,
} from "@/src/features/artifacts/repository";
import type { ArtifactStatus } from "@/src/types/learning";

type PublishedChapter = Extract<ChapterDefinition, { status: "published" }>;

type ArtifactEditorProps = Readonly<{
  chapterId: string;
  title: string;
  fields: PublishedChapter["artifactTemplate"]["fields"];
  artifactId?: string;
  version?: ArtifactVersion;
  initialPlan?: ActionPlan | null;
  actionPrompt?: PublishedChapter["actionPrompt"];
  onSaved: (artifact: Artifact) => void;
}>;

export const artifactPlanLabels = ["实践目标", "执行计划与成功标准"] as const;

const artifactStatuses: ArtifactStatus[] = ["draft", "in_practice", "review_ready", "reviewed", "archived"];

export function isArtifactPayload(value: unknown): value is Artifact {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<Artifact>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.title === "string" &&
    typeof candidate.status === "string" &&
    artifactStatuses.includes(candidate.status as ArtifactStatus) &&
    typeof candidate.currentVersion === "number" &&
    Number.isInteger(candidate.currentVersion) &&
    Array.isArray(candidate.versions) &&
    Array.isArray(candidate.reviews)
  );
}

export function ArtifactEditor({
  chapterId,
  title,
  fields,
  artifactId,
  version,
  initialPlan,
  actionPrompt,
  onSaved,
}: ArtifactEditorProps) {
  const [problem, setProblem] = useState(version?.problem ?? initialPlan?.problem ?? "");
  const [principles, setPrinciples] = useState(
    version?.principles ?? (initialPlan
      ? `${initialPlan.action}\n\n成功标准：${initialPlan.successCriteria}`
      : ""),
  );
  const rules = version?.rules ?? "";
  const successCriteria = version?.successCriteria ?? "";
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setSaveError(false);
    try {
      const response = await fetch(
        artifactId ? `/api/artifacts/${artifactId}` : "/api/artifacts",
        {
          method: artifactId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            artifactId
              ? {
                  event: "save_draft",
                  problem,
                  principles,
                  rules,
                  successCriteria,
                }
              : {
                  chapterId,
                  title,
                  problem,
                  principles,
                  rules,
                  successCriteria,
                },
          ),
        },
      );
      if (!response.ok) throw new Error("artifact_not_created");
      const payload: unknown = await response.json();
      if (!isArtifactPayload(payload)) throw new Error("invalid_artifact_payload");
      onSaved(payload);
    } catch {
      setSaveError(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save}>
      <h4>实践前：制定计划</h4>
      <p>{artifactId ? `编辑 v${version?.version ?? ""} 草稿` : title}</p>
      {version?.revisionNote ? <p>本版调整：{version.revisionNote}</p> : null}
      {actionPrompt ? <p id={actionPrompt.id}>{actionPrompt.question}</p> : null}
      <label htmlFor={fields[0].id}>{artifactPlanLabels[0]}</label>
      <p id={`${fields[0].id}-help`}>想改变什么、为什么值得做？本章提示：{fields[0].label}</p>
      <textarea id={fields[0].id} aria-describedby={`${fields[0].id}-help`} required value={problem} onChange={(event) => setProblem(event.target.value)} />
      <label htmlFor={fields[1].id}>{artifactPlanLabels[1]}</label>
      <p id={`${fields[1].id}-help`}>准备怎样做、何时做，什么结果算完成？本章提示：{fields[1].label}</p>
      <textarea id={fields[1].id} aria-describedby={`${fields[1].id}-help`} required value={principles} onChange={(event) => setPrinciples(event.target.value)} />
      {rules || successCriteria ? (
        <details>
          <summary>之前填写的补充内容</summary>
          <dl>
            {rules ? <div><dt>{fields[2].label}</dt><dd>{rules}</dd></div> : null}
            {successCriteria ? <div><dt>{fields[3].label}</dt><dd>{successCriteria}</dd></div> : null}
          </dl>
        </details>
      ) : null}
      <button type="submit" disabled={saving}>
        {saving ? "保存中…" : "保存实践计划"}
      </button>
      {saveError ? <p role="alert">实践成果卡保存失败，请重试。</p> : null}
    </form>
  );
}
