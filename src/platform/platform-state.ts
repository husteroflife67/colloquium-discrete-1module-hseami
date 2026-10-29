import { materialKey, materials } from "./catalog";
export const platformKey = "colloquium-platform-v1";
export type RecoveryRating = "understood" | "again";
export type RecoveryEntry = { materialKey: string; sourceTicketId: string; rating: RecoveryRating; date: string };
export type RecoverySession = { id: string; started: string; entries: RecoveryEntry[] };
export type PlatformSaved = { version: 1; bookmarks: string[]; sessions?: RecoverySession[] };
const keys = new Set(materials.map(materialKey));
export function validatePlatform(raw: unknown): PlatformSaved {
  const p = raw as PlatformSaved;
  if (!p || p.version !== 1 || !Array.isArray(p.bookmarks) || p.bookmarks.some(k => !keys.has(k))) throw Error("Некорректные закладки платформы");
  if (p.sessions !== undefined) {
    if (!Array.isArray(p.sessions) || p.sessions.length > 10000 || new Set(p.sessions.map(s => s?.id)).size !== p.sessions.length) throw Error("Некорректная история тренировок");
    for (const s of p.sessions) {
      if (!s || typeof s.id !== "string" || !s.id || s.id.length > 100 || (typeof s.started !== "string" || !Number.isFinite(Date.parse(s.started))) || !Array.isArray(s.entries) || s.entries.length > materials.length || new Set(s.entries.map(e => e?.materialKey)).size !== s.entries.length) throw Error("Некорректная тренировка");
      for (const e of s.entries) if (!e || !keys.has(e.materialKey) || typeof e.sourceTicketId !== "string" || !e.sourceTicketId || !["understood", "again"].includes(e.rating) || (typeof e.date !== "string" || !Number.isFinite(Date.parse(e.date)))) throw Error("Некорректный результат тренировки");
    }
  }
  return { version: 1, bookmarks: [...new Set(p.bookmarks)], ...(p.sessions !== undefined ? { sessions: p.sessions } : {}) };
}
export function readPlatform(): PlatformSaved {
  const raw = localStorage.getItem(platformKey);
  return raw ? validatePlatform(JSON.parse(raw)) : { version: 1, bookmarks: [] };
}
export const platformChanged = "platform-bookmarks-changed";
