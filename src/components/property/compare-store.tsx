"use client";

import { createContext, useCallback, useContext, useMemo, useSyncExternalStore } from "react";

/**
 * The shortlist behind the comparison tray.
 *
 * Evaluation is a first-class step, so the shortlist follows the reader across
 * listings and property pages and survives a reload. It holds ids only — every
 * figure shown in /compare is re-read from the API, so nothing here can drift
 * from what the database says.
 */

export const COMPARE_MAX = 3;
const KEY = "aarvasa-compare";

type CompareValue = {
  ids: string[];
  has: (id: string) => boolean;
  toggle: (id: string) => void;
  remove: (id: string) => void;
  clear: () => void;
  full: boolean;
  ready: boolean;
};

const CompareContext = createContext<CompareValue | null>(null);

/* A tiny external store over localStorage. useSyncExternalStore gives the
   correct server snapshot (empty) and subscribes to cross-tab writes, so no
   effect has to setState on mount. */
let snapshot: string[] = [];
let raw = "[]";
const listeners = new Set<() => void>();
const SERVER: string[] = [];

function read(): string[] {
  try {
    const next = localStorage.getItem(KEY) ?? "[]";
    if (next !== raw) {
      raw = next;
      const parsed = JSON.parse(next);
      snapshot = Array.isArray(parsed)
        ? parsed.filter((v): v is string => typeof v === "string").slice(0, COMPARE_MAX)
        : [];
    }
  } catch {
    snapshot = [];
  }
  return snapshot;
}

function write(next: string[]) {
  snapshot = next.slice(0, COMPARE_MAX);
  raw = JSON.stringify(snapshot);
  try {
    localStorage.setItem(KEY, raw);
  } catch {
    /* the shortlist still works for this page view */
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

export function CompareProvider({ children }: { children: React.ReactNode }) {
  const ids = useSyncExternalStore(subscribe, read, () => SERVER);

  const toggle = useCallback((id: string) => {
    const cur = read();
    if (cur.includes(id)) write(cur.filter((x) => x !== id));
    else if (cur.length < COMPARE_MAX) write([...cur, id]);
  }, []);

  const remove = useCallback((id: string) => write(read().filter((x) => x !== id)), []);
  const clear = useCallback(() => write([]), []);

  const value = useMemo<CompareValue>(
    () => ({
      ids,
      has: (id: string) => ids.includes(id),
      toggle,
      remove,
      clear,
      full: ids.length >= COMPARE_MAX,
      ready: true,
    }),
    [ids, toggle, remove, clear],
  );

  return <CompareContext.Provider value={value}>{children}</CompareContext.Provider>;
}

export function useCompare(): CompareValue {
  const ctx = useContext(CompareContext);
  if (ctx) return ctx;
  // Rendered outside a provider (e.g. a card on a page that has no tray):
  // the control is simply inert rather than throwing.
  return {
    ids: [],
    has: () => false,
    toggle: () => {},
    remove: () => {},
    clear: () => {},
    full: false,
    ready: false,
  };
}
