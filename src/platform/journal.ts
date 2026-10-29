import type { Saved } from "../model";
import type { PracticeSaved } from "../practice-model";
import type { Data } from "../calculus/engine";
import { materials, materialKey, type Material } from "./catalog";
import type { PlatformSaved } from "./platform-state";
export type JournalEntry = { material: Material; date: string; label: string; ticketId: string };
export function buildJournal(discrete: Saved, practice: PracticeSaved, calculus: Data): JournalEntry[] {
  const out: JournalEntry[] = [];
  const add = (course: string, kind: string | null, id: string, date: string, label: string, ticketId: string) => {
    const material = materials.find(m => m.course === course && (kind === null || m.kind === kind) && m.id === id);
    if (material) out.push({ material, date, label, ticketId });
  };
  for (const h of discrete.results) for (const id of h.questionIds) if (h.ratings[id] !== "known") add("discrete", "theory", id, h.date, h.ratings[id] === "repeat" ? "Нужно повторить" : "Не помню", h.id);
  for (const h of practice.results) for (const id of h.itemIds) if (h.ratings[id] !== "independent") add("discrete", "practice", id, h.date, "Пока не доказано самостоятельно", h.id);
  for (const h of calculus.history) for (const id of h.weak) add("calculus", null, id, h.date, "Самооценка ниже максимума", h.id);
  return out.sort((a, b) => Date.parse(b.date) - Date.parse(a.date) || b.ticketId.localeCompare(a.ticketId));
}
export function latestRecovery(platform: PlatformSaved, key: string) {
  return (platform.sessions ?? []).flatMap(s => s.entries).filter(e => e.materialKey === key).sort((a, b) => Date.parse(b.date) - Date.parse(a.date))[0];
}
export function recoveryQueue(journal: JournalEntry[], platform: PlatformSaved) {
  const seen = new Set<string>();
  return journal.filter(j => {
    const key = materialKey(j.material);
    if (seen.has(key)) return false;
    seen.add(key);
    const last = latestRecovery(platform, key);
    return !(last?.rating === "understood" && last.sourceTicketId === j.ticketId);
  });
}
