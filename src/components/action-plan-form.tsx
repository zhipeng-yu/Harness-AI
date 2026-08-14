"use client";

import { useState } from "react";
import type { ChapterDefinition } from "@/content/schema";
import type { ActionPlan } from "@/src/features/actions/repository";

type PublishedChapter = Extract<ChapterDefinition, { status: "published" }>;

type ActionPlanFormProps = Readonly<{
  chapterId: string;
  actionPrompt: PublishedChapter["actionPrompt"];
  initialValue: ActionPlan | null;
  onSaved: (saved: ActionPlan) => void;
}>;

function isActionPlan(value: unknown): value is ActionPlan {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<ActionPlan>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.ownerId === "string" &&
    typeof candidate.chapterId === "string" &&
    typeof candidate.problem === "string" &&
    typeof candidate.action === "string" &&
    typeof candidate.successCriteria === "string" &&
    typeof candidate.createdAt === "string" &&
    typeof candidate.updatedAt === "string"
  );
}

export function ActionPlanForm({
  chapterId,
  actionPrompt,
  initialValue,
  onSaved,
}: ActionPlanFormProps) {
  const [problem, setProblem] = useState(initialValue?.problem ?? "");
  const [action, setAction] = useState(initialValue?.action ?? "");
  const [successCriteria, setSuccessCriteria] = useState(
    initialValue?.successCriteria ?? "",
  );
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setSaveError(false);
    try {
      const response = await fetch("/api/action-plans", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chapterId, problem, action, successCriteria }),
      });
      if (!response.ok) throw new Error("action_plan_not_saved");
      const payload: unknown = await response.json();
      if (!isActionPlan(payload)) throw new Error("invalid_action_plan_payload");
      setProblem(payload.problem);
      setAction(payload.action);
      setSuccessCriteria(payload.successCriteria);
      onSaved(payload);
    } catch {
      setSaveError(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save}>
      <label htmlFor="action-plan-problem">现实问题</label>
      <textarea id="action-plan-problem" required value={problem} onChange={(event) => setProblem(event.target.value)} />
      <label htmlFor="action-plan-action">行动</label>
      <p id={actionPrompt.id}>{actionPrompt.question}</p>
      <textarea id="action-plan-action" aria-describedby={actionPrompt.id} required value={action} onChange={(event) => setAction(event.target.value)} />
      <label htmlFor="action-plan-success">可观察的成功标准</label>
      <textarea id="action-plan-success" required value={successCriteria} onChange={(event) => setSuccessCriteria(event.target.value)} />
      <button type="submit" disabled={saving}>{saving ? "保存中…" : "保存行动计划"}</button>
      {saveError ? <p role="alert">行动计划保存失败，请重试。</p> : null}
    </form>
  );
}
