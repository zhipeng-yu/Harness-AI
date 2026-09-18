"use client";

import { useState } from "react";
import type { ChapterDefinition } from "@/content/schema";
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
  onSaved: (artifact: Artifact) => void;
}>;

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
  onSaved,
}: ArtifactEditorProps) {
  const [problem, setProblem] = useState(version?.problem ?? "");
  const [principles, setPrinciples] = useState(version?.principles ?? "");
  const [rules, setRules] = useState(version?.rules ?? "");
  const [successCriteria, setSuccessCriteria] = useState(
    version?.successCriteria ?? "",
  );
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
      <p>{artifactId ? `编辑 v${version?.version ?? ""} 草稿` : title}</p>
      {version?.revisionNote ? <p>本版调整：{version.revisionNote}</p> : null}
      <label htmlFor={fields[0].id}>{fields[0].label}</label>
      <textarea id={fields[0].id} required value={problem} onChange={(event) => setProblem(event.target.value)} />
      <label htmlFor={fields[1].id}>{fields[1].label}</label>
      <textarea id={fields[1].id} required value={principles} onChange={(event) => setPrinciples(event.target.value)} />
      <label htmlFor={fields[2].id}>{fields[2].label}</label>
      <textarea id={fields[2].id} required value={rules} onChange={(event) => setRules(event.target.value)} />
      <label htmlFor={fields[3].id}>{fields[3].label}</label>
      <textarea id={fields[3].id} required value={successCriteria} onChange={(event) => setSuccessCriteria(event.target.value)} />
      <button type="submit" disabled={saving}>
        {saving ? "保存中…" : artifactId ? "保存草稿" : "创建实践成果卡"}
      </button>
      {saveError ? <p role="alert">实践成果卡保存失败，请重试。</p> : null}
    </form>
  );
}
