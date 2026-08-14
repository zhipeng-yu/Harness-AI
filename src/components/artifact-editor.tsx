"use client";

import { useState } from "react";
import type { ChapterDefinition } from "@/content/schema";
import type { ArtifactStatus } from "@/src/types/learning";

type PublishedChapter = Extract<ChapterDefinition, { status: "published" }>;

export type CreatedArtifactSummary = {
  id: string;
  title: string;
  status: ArtifactStatus;
  currentVersion: number;
};

type ArtifactEditorProps = Readonly<{
  chapterId: string;
  title: string;
  fields: PublishedChapter["artifactTemplate"]["fields"];
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

export function ArtifactEditor({ chapterId, title, fields, onCreated }: ArtifactEditorProps) {
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
      <label htmlFor={fields[0].id}>{fields[0].label}</label>
      <textarea id={fields[0].id} required value={problem} onChange={(event) => setProblem(event.target.value)} />
      <label htmlFor={fields[1].id}>{fields[1].label}</label>
      <textarea id={fields[1].id} required value={principles} onChange={(event) => setPrinciples(event.target.value)} />
      <label htmlFor={fields[2].id}>{fields[2].label}</label>
      <textarea id={fields[2].id} required value={rules} onChange={(event) => setRules(event.target.value)} />
      <label htmlFor={fields[3].id}>{fields[3].label}</label>
      <textarea id={fields[3].id} required value={successCriteria} onChange={(event) => setSuccessCriteria(event.target.value)} />
      <button type="submit" disabled={saving}>{saving ? "创建中…" : "创建 Artifact"}</button>
      {saveError ? <p role="alert">Artifact 创建失败，请重试。</p> : null}
    </form>
  );
}
