import type { Item } from "./content/types";
import { isReviewSchedule } from "./repetition";
import type { ReviewSchedule } from "./repetition";
export type Rating = "unknown" | "partial" | "known" | "repeat";
export type Ticket = {
  seed: number;
  definitionIds: string[];
  taskId: string;
  theoryId: string;
  shortId: string;
};
export type HistoryEntry = {
  id: string;
  date: string;
  ticket: Ticket;
  scores: number[];
  base: number;
  extra: number;
  duration: number;
  hints: number;
  weak: string[];
};
export type Data = {
  schemaVersion: 1;
  ratings: Record<string, Rating>;
  checklists: Record<string, boolean[]>;
  drafts: Record<string, string>;
  history: HistoryEntry[];
  theme: "light" | "dark";
  schedules?: Record<string, ReviewSchedule>;
};
export const emptyData = (): Data => ({
  schemaVersion: 1,
  ratings: {},
  checklists: {},
  drafts: {},
  history: [],
  theme: "light",
});
export const maxima = [0.5, 0.5, 0.5, 0.5, 1, 3, 2];
export function baseScore(scores: number[]) {
  if (
    scores.length !== 7 ||
    scores.some(
      (s, i) =>
        !Number.isFinite(s) || s < 0 || s > maxima[i] || (s * 2) % 1 !== 0,
    )
  )
    throw Error("Недопустимые баллы");
  return scores.reduce((a, b) => a + b, 0);
}
export function availableExtra(base: number) {
  if (!Number.isFinite(base) || base < 0 || base > 8 || (base * 2) % 1 !== 0)
    throw Error("Недопустимый базовый результат");
  return base <= 6 ? [1] : [1, 2];
}
export function chooseExtra(
  current: number | null,
  next: number,
  base: number,
) {
  if (current !== null || !availableExtra(base).includes(next))
    throw Error("Выбор уже сделан или стоимость недоступна");
  return next;
}
export function generateTicket(
  items: Item[],
  seed: number,
  mode: string,
  ratings: Data["ratings"],
  selected: number[],
): Ticket {
  let s = seed >>> 0;
  const random = () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
  let pool = items.filter(
    (i) => mode !== "selected" || selected.includes(i.topic),
  );
  const topicMastery = (topic: number) => {
    const related = items.filter((i) => i.topic === topic);
    return (
      related.reduce(
        (s, i) =>
          s +
          (ratings[i.id] === "known"
            ? 1
            : ratings[i.id] === "partial"
              ? 0.5
              : 0),
        0,
      ) / related.length
    );
  };
  const shuffled = (arr: Item[]) => {
    const out = [...arr];
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    if (mode === "weak")
      out.sort(
        (a, b) =>
          Number(ratings[a.id] === "known") -
            Number(ratings[b.id] === "known") ||
          topicMastery(a.topic) - topicMastery(b.topic),
      );
    return out;
  };
  const defs = shuffled(
    pool.filter(
      (i) => i.kind === "definition" && i.definitionNumber !== undefined,
    ),
  ).slice(0, 4);
  const tasks = shuffled(pool.filter((i) => i.kind === "practice"));
  const theory = shuffled(
    pool.filter((i) => i.kind === "theory" && i.required),
  )[0];
  if (defs.length < 4 || tasks.length < 2 || !theory)
    throw Error(
      "Для билета выберите больше тем: нужны 4 определения, 2 задачи и доказательство.",
    );
  return {
    seed,
    definitionIds: defs.map((i) => i.id),
    taskId: tasks[0].id,
    theoryId: theory.id,
    shortId: tasks[1].id,
  };
}
export function validateImport(
  raw: unknown,
  ids: Set<string>,
  catalog?: Item[],
): Data {
  const fail = () => {
    throw Error(
      "Файл не соответствует схеме версии 1 или содержит неизвестные ID. Текущие данные сохранены.",
    );
  };
  if (!raw || typeof raw !== "object") return fail();
  const d = raw as Data;
  if (
    [d.ratings, d.checklists, d.drafts].some(
      (v) => !v || typeof v !== "object" || Array.isArray(v),
    )
  )
    return fail();
  if (
    d.schemaVersion !== 1 ||
    !["light", "dark"].includes(d.theme) ||
    !d.ratings ||
    !d.checklists ||
    !d.drafts ||
    !Array.isArray(d.history) ||
    d.history.length > 10000
  )
    return fail();
  for (const [k, v] of Object.entries(d.ratings))
    if (!ids.has(k) || !["unknown", "partial", "known", "repeat"].includes(v))
      return fail();
  for (const [k, v] of Object.entries(d.drafts))
    if (!ids.has(k) || typeof v !== "string" || v.length > 100000)
      return fail();
  if (d.schedules !== undefined) {
    if (
      !d.schedules ||
      typeof d.schedules !== "object" ||
      Array.isArray(d.schedules)
    )
      return fail();
    for (const [id, value] of Object.entries(d.schedules))
      if (!ids.has(id) || !isReviewSchedule(value)) return fail();
  }
  for (const [k, v] of Object.entries(d.checklists))
    if (
      !/^[1-8]$/.test(k) ||
      !Array.isArray(v) ||
      v.length !== 7 ||
      v.some((x) => typeof x !== "boolean")
    )
      return fail();
  for (const h of d.history) {
    if (catalog && h?.ticket) {
      const t = h.ticket;
      const kind = (id: string) => catalog.find((i) => i.id === id);
      if (
        !Array.isArray(t.definitionIds) ||
        t.definitionIds.some((id) => kind(id)?.kind !== "definition") ||
        kind(t.taskId)?.kind !== "practice" ||
        kind(t.shortId)?.kind !== "practice" ||
        kind(t.theoryId)?.kind !== "theory" ||
        !kind(t.theoryId)?.required ||
        t.taskId === t.shortId
      )
        return fail();
    }
    try {
      if (
        !h ||
        typeof h.id !== "string" ||
        typeof h.date !== "string" ||
        !Number.isFinite(Date.parse(h.date)) ||
        !h.ticket ||
        !Number.isInteger(h.ticket.seed) ||
        !Array.isArray(h.ticket.definitionIds) ||
        h.ticket.definitionIds.length !== 4 ||
        new Set(h.ticket.definitionIds).size !== 4 ||
        [
          ...h.ticket.definitionIds,
          h.ticket.taskId,
          h.ticket.theoryId,
          h.ticket.shortId,
        ].some((id) => !ids.has(id)) ||
        baseScore(h.scores) !== h.base ||
        !Number.isFinite(h.extra) ||
        h.extra < 0 ||
        h.extra > Math.max(...availableExtra(h.base)) ||
        (h.extra * 2) % 1 !== 0 ||
        !Number.isFinite(h.duration) ||
        h.duration < 0 ||
        !Number.isInteger(h.hints) ||
        h.hints < 0 ||
        !Array.isArray(h.weak) ||
        h.weak.some((id) => !ids.has(id))
      )
        return fail();
    } catch {
      return fail();
    }
  }
  return {
    schemaVersion: 1,
    ratings: { ...d.ratings },
    checklists: { ...d.checklists },
    drafts: { ...d.drafts },
    history: d.history,
    theme: d.theme,
    ...(d.schedules !== undefined ? { schedules: { ...d.schedules } } : {}),
  };
}
export type Stage =
  | "prep"
  | "definitions"
  | "second"
  | "grade"
  | "extraSolve"
  | "extraAnswer"
  | "done";
export function timerState(
  elapsed: number,
  stage: Stage,
  stageStarted: number,
  definitionsDone: boolean,
) {
  if (elapsed >= 7200)
    return { next: "grade" as Stage, remaining: 0, limit: true };
  if (stage === "prep") {
    if (!definitionsDone && elapsed >= 1500)
      return {
        next: "definitions" as Stage,
        remaining: Math.max(0, 1800 - elapsed),
        limit: false,
      };
    return {
      next: elapsed >= 1800 ? ("second" as Stage) : stage,
      remaining: Math.max(0, 1800 - elapsed),
      limit: false,
    };
  }
  const caps: Partial<Record<Stage, number>> = {
    definitions: 300,
    second: 2400,
    extraSolve: 1200,
    extraAnswer: 600,
  };
  const cap = caps[stage];
  const remaining =
    cap === undefined
      ? 0
      : Math.max(
          0,
          Math.min(
            cap - (elapsed - stageStarted),
            7200 - elapsed,
            stage === "definitions" ? 1800 - elapsed : Infinity,
          ),
        );
  const next =
    remaining === 0
      ? ((
          {
            definitions: "prep",
            second: "grade",
            extraSolve: "extraAnswer",
            extraAnswer: "grade",
          } as Partial<Record<Stage, Stage>>
        )[stage] ?? stage)
      : stage;
  return { next, remaining, limit: false };
}
