"use client";

import { useCallback, useState } from "react";
import { useAutosave } from "./use-autosave";

function hasValidUpdatedAt(value: unknown): value is { updatedAt: string } {
  if (typeof value !== "object" || value === null || !("updatedAt" in value)) return false;
  const updatedAt = value.updatedAt;
  if (typeof updatedAt !== "string") return false;
  const timestamp = Date.parse(updatedAt);
  return !Number.isNaN(timestamp) && new Date(timestamp).toISOString() === updatedAt;
}

export type AutosaveFieldProps = Readonly<{
  chapterId: string;
  promptId: string;
  label: string;
  initialValue: string;
}>;

export function AutosaveField({
  chapterId,
  promptId,
  label,
  initialValue,
}: AutosaveFieldProps) {
  const [value, setValue] = useState(initialValue);
  const save = useCallback(
    async (nextValue: string, signal: AbortSignal) => {
      const response = await fetch("/api/responses", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chapterId, promptId, value: nextValue }),
        signal,
      });
      if (!response.ok) throw new Error("response_not_saved");
      const payload: unknown = await response.json();
      if (!hasValidUpdatedAt(payload)) throw new Error("invalid_response_payload");
    },
    [chapterId, promptId],
  );
  const { state, retry } = useAutosave(value, save);
  const fieldId = `response-${promptId}`;

  return (
    <div>
      <label htmlFor={fieldId}>{label}</label>
      <textarea
        id={fieldId}
        value={value}
        onChange={(event) => setValue(event.target.value)}
      />
      {state === "saving" ? <p>保存中…</p> : null}
      {state === "saved" ? <p>已保存</p> : null}
      {state === "error" ? (
        <div role="alert">
          <p>保存失败，请重试。</p>
          <button type="button" onClick={retry}>
            重试保存
          </button>
        </div>
      ) : null}
    </div>
  );
}
