"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type SaveState = "idle" | "saving" | "saved" | "error";

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

export function useAutosave(
  value: string,
  save: (value: string, signal: AbortSignal) => Promise<void>,
) {
  const [savedValue, setSavedValue] = useState(value);
  const [state, setState] = useState<SaveState>("idle");
  const controllerRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const saveValue = useCallback(
    async (nextValue: string, controller: AbortController) => {
      setState("saving");
      try {
        await save(nextValue, controller.signal);
        if (controller.signal.aborted) {
          if (mountedRef.current && controllerRef.current === controller) {
            controllerRef.current = null;
            setState("idle");
          }
          return;
        }
        setSavedValue(nextValue);
        setState("saved");
      } catch (error) {
        if (controller.signal.aborted || isAbortError(error)) {
          if (mountedRef.current && controllerRef.current === controller) {
            controllerRef.current = null;
            setState("idle");
          }
        } else {
          setState("error");
        }
      }
    },
    [save],
  );

  useEffect(() => {
    if (value === savedValue) return;

    const controller = new AbortController();
    controllerRef.current?.abort();
    controllerRef.current = controller;
    const timer = window.setTimeout(() => {
      void saveValue(value, controller);
    }, 800);

    return () => {
      window.clearTimeout(timer);
      controllerRef.current?.abort();
    };
  }, [value, savedValue, saveValue]);

  const dirty = value !== savedValue;

  useEffect(() => {
    if (!dirty) return;

    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warnBeforeUnload);
    return () => window.removeEventListener("beforeunload", warnBeforeUnload);
  }, [dirty]);

  const retry = useCallback(() => {
    if (!dirty) return;
    const controller = new AbortController();
    controllerRef.current?.abort();
    controllerRef.current = controller;
    void saveValue(value, controller);
  }, [dirty, saveValue, value]);

  return { state, dirty, retry };
}
