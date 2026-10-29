import { calculusRebase } from "./calculus/sync-model";
import { rebaseLocalWrite } from "./sync-model";
import { useEffect } from "react";
export const progressChanged = "discrete-progress-changed";
export const progressWritten = "discrete-progress-written";
export type ProgressWrite = {
  key: string;
  before: string | null;
  after: string;
};
export function saveProgress(key: string, value: unknown, previous?: unknown) {
  const before = localStorage.getItem(key);
  const after = JSON.stringify(
    previous === undefined
      ? value
      : (key.startsWith("predel-v1") ? calculusRebase : rebaseLocalWrite)(key, previous, value, before),
  );
  localStorage.setItem(key, after);
  window.dispatchEvent(
    new CustomEvent<ProgressWrite>(progressWritten, {
      detail: { key, before, after },
    }),
  );
  window.dispatchEvent(new CustomEvent(progressChanged, { detail: { key } }));
}
export function announceProgress(key: string) {
  window.dispatchEvent(new CustomEvent(progressChanged, { detail: { key } }));
}

export function useProgressReload<T>(
  key: string,
  read: () => T,
  set: (value: T) => void,
) {
  useEffect(() => {
    const reload = (event: Event) => {
      if (event instanceof StorageEvent) {
        if (event.key !== key) return;
      } else if ((event as CustomEvent).detail?.key !== key) return;
      try {
        set(read());
      } catch {
        /* Preserve the current visible progress if cached data is unreadable. */
      }
    };
    window.addEventListener(progressChanged, reload);
    window.addEventListener("storage", reload);
    return () => {
      window.removeEventListener(progressChanged, reload);
      window.removeEventListener("storage", reload);
    };
  }, [key, read, set]);
}
