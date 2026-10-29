import { readSaved, storageKey, ratedEntry } from "../model";
import { loadPractice, practiceKey } from "../practice-model";
import { items } from "../calculus/content";
import { emptyData, validateImport } from "../calculus/engine";
import { scheduleReview } from "../calculus/repetition";
import { progressWritten, announceProgress } from "../progress-events";
import { materialKey, type Material } from "./catalog";
import { platformKey, platformChanged, readPlatform, validatePlatform, type RecoveryRating, type RecoverySession } from "./platform-state";
import { buildJournal } from "./journal";
export function readCalculus() {
  const raw = localStorage.getItem("predel-v1");
  return raw ? validateImport(JSON.parse(raw), new Set(items.map(i => i.id)), items) : emptyData();
}
export function readRecoveryState() {
  return { journal: buildJournal(readSaved(), loadPractice(), readCalculus()), platform: readPlatform() };
}
export function saveRecovery(session: Pick<RecoverySession, "id" | "started">, material: Material, sourceTicketId: string, rating: RecoveryRating, now = Date.now()) {
  const platform = readPlatform();
  const entry = { materialKey: materialKey(material), sourceTicketId, rating, date: new Date(now).toISOString() };
  const oldSession = platform.sessions?.find(s => s.id === session.id);
  const updated: RecoverySession = { ...session, entries: [...(oldSession?.entries.filter(e => e.materialKey !== entry.materialKey) ?? []), entry] };
  platform.sessions = [updated, ...(platform.sessions ?? []).filter(s => s.id !== session.id)];
  validatePlatform(platform);
  let key: string, value: unknown;
  if (material.course === "calculus") {
    key = "predel-v1";
    const data = readCalculus();
    const next = rating === "understood" ? "known" : "repeat";
    data.ratings[material.id] = next;
    data.schedules = { ...(data.schedules ?? {}), [material.id]: scheduleReview(data.schedules?.[material.id], next, now) };
    value = data;
  } else if (material.kind === "theory") {
    key = storageKey; const data = readSaved();
    value = { ...data, progress: { ...data.progress, [material.id]: ratedEntry(rating === "understood" ? "known" : "repeat") } };
  } else {
    key = practiceKey; const data = loadPractice();
    value = { ...data, progress: { ...data.progress, [material.id]: rating === "understood" ? "independent" : "repeat" } };
  }
  const beforePlatform = localStorage.getItem(platformKey), beforeProgress = localStorage.getItem(key);
  const after = JSON.stringify(value);
  try {
    localStorage.setItem(platformKey, JSON.stringify(platform));
    localStorage.setItem(key, after);
  } catch (error) {
    try { beforePlatform === null ? localStorage.removeItem(platformKey) : localStorage.setItem(platformKey, beforePlatform); } catch { /* Report failure; never advance the session UI. */ }
    throw error;
  }
  window.dispatchEvent(new CustomEvent(progressWritten, { detail: { key, before: beforeProgress, after } }));
  announceProgress(key);
  window.dispatchEvent(new Event(platformChanged));
  return updated;
}
