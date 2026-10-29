import { items } from "./content";
import { emptyData, validateImport, type Data } from "./engine";
import type { CloudRow, CloudValue, Journal, Mutation } from "../sync-model";
import type { SyncCodec } from "../sync-engine";

export const calculusKeys = { study: "predel-v1", questions: "predel-v1-questions" };
const ids = new Set(items.map(i => i.id));
const questionIds = new Set(items.flatMap(i => i.questions.map(q => q.id)));
const ratings = ["unknown", "partial", "known", "repeat"];
export function validateQuestions(raw: unknown): Record<string, Data["ratings"][string]> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw Error("Некорректные оценки уточнений");
  for (const [id, value] of Object.entries(raw)) if (!questionIds.has(id) || !ratings.includes(String(value))) throw Error("Некорректная оценка уточнения");
  return raw as Record<string, Data["ratings"][string]>;
}
const deleted = (value: CloudValue) => typeof value === "object" && value !== null && value.deleted === true && Object.keys(value).length === 1;
export function calculusValidRow(raw: unknown): raw is CloudRow {
  if (!raw || typeof raw !== "object") return false;
  const r = raw as CloudRow;
  if (typeof r.key !== "string" || !Number.isSafeInteger(r.revision) || r.revision < 1 || typeof r.mutation_id !== "string") return false;
  const [kind, id, extra] = r.key.split("/");
  if (extra || !id) return false;
  if (!["rating", "draft", "schedule", "checklist", "question", "history", "setting"].includes(kind)) return false;
  if (["rating", "draft", "schedule"].includes(kind) && !ids.has(id)) return false;
  if (kind === "question" && !questionIds.has(id)) return false;
  if (kind === "checklist" && !/^[1-8]$/.test(id)) return false;
  if (kind === "setting" && id !== "theme") return false;
  if (kind === "history" && !/^[A-Za-z0-9_.-]{1,100}$/.test(id)) return false;
  if (deleted(r.value)) return kind !== "setting";
  try {
    const data = emptyData();
    if (kind === "rating") data.ratings[id] = r.value as Data["ratings"][string];
    if (kind === "draft") data.drafts[id] = r.value as string;
    if (kind === "schedule") data.schedules = { [id]: r.value as NonNullable<Data["schedules"]>[string] };
    if (kind === "checklist") data.checklists[id] = (r.value as { values: boolean[] }).values;
    if (kind === "question") validateQuestions({ [id]: r.value });
    if (kind === "history") {
      if ((r.value as Data["history"][number]).id !== id) return false;
      data.history = [r.value as Data["history"][number]];
    }
    if (kind === "setting") data.theme = r.value as Data["theme"];
    validateImport(data, ids, items);
    return true;
  } catch { return false; }
}
export function calculusFlatten(key: string, raw: string | null): Record<string, CloudValue> {
  if (!raw) return {};
  const value = JSON.parse(raw);
  if (key === calculusKeys.questions) return Object.fromEntries(Object.entries(validateQuestions(value)).map(([id, v]) => [`question/${id}`, v]));
  if (key !== calculusKeys.study) throw Error("Unknown calculus key");
  const data = validateImport(value, ids, items);
  return {
    ...Object.fromEntries(Object.entries(data.ratings).map(([id, v]) => [`rating/${id}`, v])),
    ...Object.fromEntries(Object.entries(data.drafts).map(([id, v]) => [`draft/${id}`, v])),
    ...Object.fromEntries(Object.entries(data.schedules ?? {}).map(([id, v]) => [`schedule/${id}`, v])),
    ...Object.fromEntries(Object.entries(data.checklists).map(([id, v]) => [`checklist/${id}`, { values: v }])),
    ...Object.fromEntries(data.history.map(v => [`history/${v.id}`, v])),
    "setting/theme": data.theme,
  };
}
export function calculusChanges(key: string, before: string | null, after: string) {
  let old: Record<string, CloudValue> = {};
  try { old = calculusFlatten(key, before); } catch { /* Explicit edit may recover corrupt cache. */ }
  const next = calculusFlatten(key, after);
  for (const id of Object.keys(old)) if (!(id in next)) next[id] = { deleted: true };
  return Object.entries(next).filter(([id, value]) => JSON.stringify(old[id]) !== JSON.stringify(value));
}
export function calculusApply(rows: CloudRow[], pending: Record<string, Mutation>, cache: Record<string, string | null>) {
  const data = cache[calculusKeys.study] ? validateImport(JSON.parse(cache[calculusKeys.study]!), ids, items) : emptyData();
  const questions = cache[calculusKeys.questions] ? validateQuestions(JSON.parse(cache[calculusKeys.questions]!)) : {};
  const changed = new Set<string>();
  for (const row of rows) {
    if (!calculusValidRow(row)) throw Error("Invalid calculus server response");
    if (pending[row.key]) continue;
    const [kind, id] = row.key.split("/");
    const remove = deleted(row.value);
    if (kind === "question") {
      if (remove) delete questions[id]; else questions[id] = row.value as Data["ratings"][string];
      changed.add(calculusKeys.questions); continue;
    }
    if (kind === "history") {
      data.history = data.history.filter(h => h.id !== id);
      if (!remove) data.history.push(row.value as Data["history"][number]);
      data.history.sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
    } else if (kind === "setting") data.theme = row.value as Data["theme"];
    else {
      const record: Record<string, unknown> = kind === "rating" ? data.ratings : kind === "draft" ? data.drafts : kind === "checklist" ? data.checklists : (data.schedules ??= {});
      if (remove) delete record[id]; else record[id] = kind === "checklist" ? (row.value as { values: boolean[] }).values : row.value;
    }
    changed.add(calculusKeys.study);
  }
  return Object.fromEntries([...changed].map(key => [key, JSON.stringify(key === calculusKeys.study ? data : questions)]).filter(([key, value]) => cache[key] !== value));
}
export function calculusRebase(key: string, previous: unknown, proposed: unknown, current: string | null) {
  if (!previous || !current) return proposed;
  const rows = calculusChanges(key, JSON.stringify(previous), JSON.stringify(proposed)).map(([field, value]) => ({ key: field, value, revision: 1, mutation_id: "local-edit" }));
  const updates = calculusApply(rows, {}, { [key]: current });
  return updates[key] ? JSON.parse(updates[key]) : JSON.parse(current);
}
const freshJournal = (): Journal => ({ version: 1, owner: null, revisions: {}, pending: {}, conflicts: {} });
export const calculusCodec: SyncCodec = {
  localKeys: calculusKeys, journalKey: "predel-sync-v1", newJournal: freshJournal,
  readJournal: () => {
    const raw = localStorage.getItem("predel-sync-v1");
    if (!raw) return freshJournal();
    const j = JSON.parse(raw);
    if (j?.version !== 1 || (j.owner !== null && typeof j.owner !== "string") || !j.pending || !j.revisions || !j.conflicts) throw Error("Invalid calculus journal");
    return j;
  },
  flatten: calculusFlatten, changesBetween: calculusChanges, applyRows: calculusApply, validCloudRow: calculusValidRow,
  rpc: "sync_calculus_progress", accountPrefix: "predel-account-",
};
