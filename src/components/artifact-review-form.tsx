"use client";

import { useState } from "react";
import type { ArtifactStatus } from "@/src/types/learning";

export type ArtifactState = { status: ArtifactStatus; version: number };

type ArtifactReviewFormProps = Readonly<{
  artifactId: string;
  onSaved: (state: ArtifactState) => void;
}>;

const artifactStatuses: ArtifactStatus[] = ["draft", "in_practice", "review_ready", "reviewed", "archived"];

export function isArtifactState(value: unknown): value is ArtifactState {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<ArtifactState>;
  return (
    typeof candidate.status === "string" &&
    artifactStatuses.includes(candidate.status as ArtifactStatus) &&
    typeof candidate.version === "number" &&
    Number.isInteger(candidate.version)
  );
}

export function ArtifactReviewForm({ artifactId, onSaved }: ArtifactReviewFormProps) {
  const [actualResult, setActualResult] = useState("");
  const [effective, setEffective] = useState("");
  const [nextChange, setNextChange] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const complete = Boolean(actualResult.trim() && effective.trim() && nextChange.trim());

  async function save(createNextVersion: boolean) {
    setSaving(true);
    setSaveError(false);
    try {
      const response = await fetch(`/api/artifacts/${artifactId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event: "submit_review", actualResult, effective, nextChange, createNextVersion }),
      });
      if (!response.ok) throw new Error("artifact_review_not_saved");
      const payload: unknown = await response.json();
      if (!isArtifactState(payload)) throw new Error("invalid_artifact_state");
      onSaved(payload);
    } catch {
      setSaveError(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={(event) => event.preventDefault()}>
      <label htmlFor="artifact-review-actual">实际发生了什么</label>
      <textarea id="artifact-review-actual" required value={actualResult} onChange={(event) => setActualResult(event.target.value)} />
      <label htmlFor="artifact-review-effective">什么有效、什么没有</label>
      <textarea id="artifact-review-effective" required value={effective} onChange={(event) => setEffective(event.target.value)} />
      <label htmlFor="artifact-review-next">下一版本只改一件什么事</label>
      <textarea id="artifact-review-next" required value={nextChange} onChange={(event) => setNextChange(event.target.value)} />
      <button type="button" disabled={saving || !complete} onClick={() => void save(false)}>完成复盘</button>
      <button type="button" disabled={saving || !complete} onClick={() => void save(true)}>完成复盘并创建下一版本</button>
      {saveError ? <p role="alert">复盘保存失败，请重试。</p> : null}
    </form>
  );
}
