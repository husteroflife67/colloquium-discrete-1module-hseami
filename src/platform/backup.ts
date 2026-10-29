import { localKeys } from "../sync-model";
import { validateBackup, type ProgressBackup } from "../progress-backup";
import { emptyData, validateImport } from "../calculus/engine";
import { items } from "../calculus/content";
import { validateQuestions } from "../calculus/sync-model";
import { platformKey, validatePlatform } from "./platform-state";
import { progressWritten, announceProgress } from "../progress-events";

export const backupKeys = [...Object.values(localKeys), "predel-v1", "predel-v1-questions", platformKey];
export type UnifiedBackup = { format: "colloquium-platform-backup"; version: 1; data: Record<string, unknown> };
const ids = new Set(items.map(i => i.id));
export function exportBackup(): UnifiedBackup {
  const data = Object.fromEntries(backupKeys.map(key => [key, JSON.parse(localStorage.getItem(key) ?? "null")]));
  const backup: UnifiedBackup = { format: "colloquium-platform-backup", version: 1, data };
  parseBackup(backup);
  return backup;
}
export function parseBackup(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw Error("Некорректный файл прогресса");
  const b = raw as Record<string, any>;
  let data: Record<string, unknown>;
  if (b.format === "colloquium-platform-backup" && b.version === 1 && b.data && typeof b.data === "object" && !Array.isArray(b.data)) data = b.data;
  else if (b.format === "discrete-progress-backup") {
    const { backup } = validateBackup(raw);
    data = Object.fromEntries(Object.entries(localKeys).map(([name, key]) => [key, backup.data[name as keyof ProgressBackup["data"]]]));
  } else if (b.schemaVersion === 1) data = { "predel-v1": b, ...(b.questionRatings ? { "predel-v1-questions": b.questionRatings } : {}) };
  else throw Error("Поддерживаются копия платформы и прежние экспорты обоих курсов");
  if (Object.keys(data).some(key => !backupKeys.includes(key))) throw Error("Файл содержит неизвестные разделы");
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value == null) continue;
    if (key === "predel-v1") result[key] = validateImport(value, ids, items);
    else if (key === "predel-v1-questions") result[key] = validateQuestions(value);
    else if (key === platformKey) {
      result[key] = validatePlatform(value);
    } else {
      const name = Object.entries(localKeys).find(([, k]) => k === key)![0];
      validateBackup({ format: "discrete-progress-backup", version: 1, data: { [name]: value } });
      result[key] = value;
    }
  }
  return result;
}
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
export function prepareImport(incoming: Record<string, unknown>, choice: "local" | "import" = "local") {
  let conflicts = 0, added = 0;
  const mergeRecord = (local: Record<string, any>, next: Record<string, any>) => {
    const out: Record<string, any> = Object.assign(Object.create(null), local);
    for (const [key, value] of Object.entries(next)) {
      if (!(key in out)) { out[key] = value; added++; }
      else if (!same(out[key], value)) { conflicts++; if (choice === "import") out[key] = value; }
    }
    return out;
  };
  const updates: Record<string, string> = {};
  for (const [key, value] of Object.entries(incoming)) {
    const raw = localStorage.getItem(key);
    const local = raw ? JSON.parse(raw) : null;
    const next = value as any;
    let merged: unknown;
    if (key === platformKey) {
      if (local) validatePlatform(local);
      const sessions = mergeRecord(Object.fromEntries((local?.sessions ?? []).map((s: any) => [s.id, s])), Object.fromEntries((next.sessions ?? []).map((s: any) => [s.id, s])));
      merged = { version: 1, bookmarks: [...new Set([...(local?.bookmarks ?? []), ...next.bookmarks])], ...(Object.keys(sessions).length ? { sessions: Object.values(sessions).sort((a, b) => Date.parse(b.started) - Date.parse(a.started)) } : {}) };
    }
    else if (key === "predel-v1-questions") {
      if (local) validateQuestions(local);
      merged = mergeRecord(local ?? {}, next);
    } else if (key === "predel-v1") {
      const old = local ? validateImport(local, ids, items) : emptyData();
      const history = mergeRecord(Object.fromEntries(old.history.map(h => [h.id, h])), Object.fromEntries(next.history.map((h: any) => [h.id, h])));
      merged = { schemaVersion: 1, ratings: mergeRecord(old.ratings, next.ratings), drafts: mergeRecord(old.drafts, next.drafts), checklists: mergeRecord(old.checklists, next.checklists), schedules: mergeRecord(old.schedules ?? {}, next.schedules ?? {}), history: Object.values(history).sort((a, b) => Date.parse(b.date) - Date.parse(a.date)), theme: choice === "import" || !local ? next.theme : old.theme };
    } else {
      const name = Object.entries(localKeys).find(([, k]) => k === key)![0];
      if (local) validateBackup({ format: "discrete-progress-backup", version: 1, data: { [name]: local } });
      if (key === localKeys.plan) merged = { version: 1, done: mergeRecord(local?.done ?? {}, next.done) };
      else merged = { version: 1, progress: mergeRecord(local?.progress ?? {}, next.progress), results: Object.values(mergeRecord(Object.fromEntries((local?.results ?? []).map((r: any) => [r.id, r])), Object.fromEntries(next.results.map((r: any) => [r.id, r])))).sort((a: any, b: any) => Date.parse(b.date) - Date.parse(a.date)) };
    }
    updates[key] = JSON.stringify(merged);
  }
  return { updates, conflicts, added };
}
export function commitImport(updates: Record<string, string>) {
  const before = Object.fromEntries(backupKeys.map(key => [key, localStorage.getItem(key)]));
  // Complete durable copy first. A quota failure here leaves all course data untouched.
  localStorage.setItem("colloquium-before-import-v1", JSON.stringify({ version: 1, data: before }));
  try {
    for (const [key, value] of Object.entries(updates)) localStorage.setItem(key, value);
  } catch (error) {
    for (const key of Object.keys(updates)) {
      try { before[key] == null ? localStorage.removeItem(key) : localStorage.setItem(key, before[key]!); } catch { /* Original remains in durable pre-import copy. */ }
    }
    throw error;
  }
  for (const [key, after] of Object.entries(updates)) {
    window.dispatchEvent(new CustomEvent(progressWritten, { detail: { key, before: before[key], after } }));
    announceProgress(key);
  }
}
