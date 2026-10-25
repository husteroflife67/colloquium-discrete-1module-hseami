import raw from "./data/practice.json" with { type: "json" };
import { sample } from "./model";
export type Source = "lecture" | "class" | "homework";
export type StudyStatus = "unseen" | "working" | "independent" | "repeat";
export type PracticeItem = {
  id: string;
  number: string;
  parentNumber: string;
  part: string;
  source: Source;
  session: number;
  file: string;
  page: number;
  starred: boolean;
  originalImage: string;
  originalImages?: string[];
  statement: string;
  sourceUrl: string;
  topicId: string;
  type: string;
  proofEligible: boolean;
  outOfScope: boolean;
  blocked: boolean;
  reviewNotes: string[];
  prerequisites: string[];
  idea: string;
  steps: string[];
  transitions: string[];
  solutionOrigin: string;
  solutionNote: string;
  sourceProofPage?: number;
  programmeNumber?: number | null;
};
export const practice = raw as {
  schemaVersion: number;
  topics: { id: string; title: string; description: string; label: string }[];
  items: PracticeItem[];
  coverageNote: string;
};
export const statusLabels: Record<StudyStatus, string> = {
  unseen: "Не разбирал",
  working: "Разбираю",
  independent: "Могу доказать самостоятельно",
  repeat: "Нужно повторить",
};
export const sourceLabels: Record<Source, string> = {
  lecture: "Лекция",
  class: "Классная работа",
  homework: "Домашнее задание",
};
export const typeLabels: Record<string, string> = {
  proof: "Доказательство",
  calculation: "Вычисление",
  reasoning: "Обоснование",
  construction: "Построение",
  mixed: "Смешанное задание",
};
export const practiceKey = "discrete-practice-v1";
export type PracticeResult = {
  id: string;
  date: string;
  itemIds: string[];
  ratings: Record<string, StudyStatus>;
};
export type PracticeSaved = {
  version: 1;
  progress: Record<string, StudyStatus>;
  results: PracticeResult[];
};
export const emptyPractice: PracticeSaved = {
  version: 1,
  progress: {},
  results: [],
};
export function loadPractice(): PracticeSaved {
  const raw = localStorage.getItem(practiceKey);
  if (!raw) return emptyPractice;
  const s = JSON.parse(raw);
  if (s?.version !== 1 || !s.progress || !Array.isArray(s.results))
    throw Error("Invalid practice storage");
  const valid = (v: unknown) =>
    typeof v === "string" && Object.hasOwn(statusLabels, v);
  if (!Object.values(s.progress).every(valid)) throw Error("Invalid progress");
  for (const r of s.results)
    if (
      !r ||
      typeof r.id !== "string" ||
      typeof r.date !== "string" ||
      !Array.isArray(r.itemIds) ||
      !r.ratings ||
      !r.itemIds.every(
        (id: unknown) => typeof id === "string" && valid(r.ratings[id]),
      )
    )
      throw Error("Invalid history");
  return s;
}
export function isOptionalClass(q: PracticeItem) {
  return q.source === "class" && q.starred;
}
export function eligibleProofs(
  items: PracticeItem[],
  options: { topicIds: string[]; includeOutside: boolean; onlyReady: boolean },
) {
  return items.filter(
    (q) =>
      q.proofEligible &&
      !isOptionalClass(q) &&
      !q.blocked &&
      options.topicIds.includes(q.topicId) &&
      (!q.outOfScope || options.includeOutside) &&
      (!options.onlyReady ||
        q.steps.length > 0 ||
        q.solutionOrigin === "source"),
  );
}
export function generateProofTicket(
  items: PracticeItem[],
  count: number,
  options: Parameters<typeof eligibleProofs>[1],
) {
  const pool = eligibleProofs(items, options);
  const unique = [...new Map(pool.map((q) => [q.id, q])).values()];
  return sample(unique, count);
}
export function sourceText(q: PracticeItem) {
  return `${sourceLabels[q.source]} · ${q.source === "lecture" ? "лекция" : q.source === "class" ? "занятие" : "номер по задачам"} ${q.session} · ${q.file} · стр. ${q.page}`;
}
