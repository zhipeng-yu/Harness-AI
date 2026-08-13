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
  const [stateValue, setStateValue] = useState(value);
  const controllerRef = useRef<AbortController | null>(null);
  const timerRef = useRef<number | null>(null);
  const mountedRef = useRef(true);

  if (value !== stateValue) {
    setStateValue(value);
    if (value === savedValue) setState("idle");
  }

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const saveValue = useCallback(
    async (nextValue: string, controller: AbortController) => {
      if (controller.signal.aborted || controllerRef.current !== controller) return;
      setState("saving");
      try {
        await save(nextValue, controller.signal);
        if (controller.signal.aborted || controllerRef.current !== controller) {
          if (mountedRef.current && controllerRef.current === controller) {
            controllerRef.current = null;
            setState("idle");
          }
          return;
        }
        setSavedValue(nextValue);
        controllerRef.current = null;
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

  const clearTimer = useCallback(() => {
    if (timerRef.current === null) return;
    window.clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  useEffect(() => {
    if (value === savedValue) {
      clearTimer();
      controllerRef.current?.abort();
      controllerRef.current = null;
      return;
    }

    const controller = new AbortController();
    controllerRef.current?.abort();
    controllerRef.current = controller;
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      void saveValue(value, controller);
    }, 800);

    return () => {
      clearTimer();
      controllerRef.current?.abort();
    };
  }, [clearTimer, value, savedValue, saveValue]);

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
    clearTimer();
    const controller = new AbortController();
    controllerRef.current?.abort();
    controllerRef.current = controller;
    void saveValue(value, controller);
  }, [clearTimer, dirty, saveValue, value]);

  return { state, dirty, retry };
}
