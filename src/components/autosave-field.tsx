"use client";

import { useCallback, useState } from "react";
import { useAutosave } from "./use-autosave";

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
