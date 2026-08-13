"use client";

import { useState } from "react";
import type { ArtifactStatus } from "@/src/types/learning";

export type CreatedArtifactSummary = {
  id: string;
  title: string;
  status: ArtifactStatus;
  currentVersion: number;
};

type ArtifactEditorProps = Readonly<{
  chapterId: string;
  title: string;
  onCreated: (artifact: CreatedArtifactSummary) => void;
}>;

const artifactStatuses: ArtifactStatus[] = ["draft", "in_practice", "review_ready", "reviewed", "archived"];

function isCreatedArtifact(value: unknown): value is CreatedArtifactSummary {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<CreatedArtifactSummary>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.title === "string" &&
    typeof candidate.status === "string" &&
    artifactStatuses.includes(candidate.status as ArtifactStatus) &&
    typeof candidate.currentVersion === "number" &&
    Number.isInteger(candidate.currentVersion)
  );
}

export function ArtifactEditor({ chapterId, title, onCreated }: ArtifactEditorProps) {
  const [problem, setProblem] = useState("");
  const [principles, setPrinciples] = useState("");
  const [rules, setRules] = useState("");
  const [successCriteria, setSuccessCriteria] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setSaveError(false);
    try {
      const response = await fetch("/api/artifacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chapterId, title, problem, principles, rules, successCriteria }),
      });
      if (!response.ok) throw new Error("artifact_not_created");
      const payload: unknown = await response.json();
      if (!isCreatedArtifact(payload)) throw new Error("invalid_artifact_payload");
      onCreated(payload);
    } catch {
      setSaveError(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save}>
      <p>{title}</p>
      <label htmlFor="artifact-problem">要解决的现实问题</label>
      <textarea id="artifact-problem" required value={problem} onChange={(event) => setProblem(event.target.value)} />
      <label htmlFor="artifact-principles">从课程采用的核心原则</label>
      <textarea id="artifact-principles" required value={principles} onChange={(event) => setPrinciples(event.target.value)} />
      <label htmlFor="artifact-rules">运行规则</label>
      <textarea id="artifact-rules" required value={rules} onChange={(event) => setRules(event.target.value)} />
      <label htmlFor="artifact-success">可观察的成功标准</label>
      <textarea id="artifact-success" required value={successCriteria} onChange={(event) => setSuccessCriteria(event.target.value)} />
      <button type="submit" disabled={saving}>{saving ? "创建中…" : "创建 Artifact"}</button>
      {saveError ? <p role="alert">Artifact 创建失败，请重试。</p> : null}
    </form>
  );
}
