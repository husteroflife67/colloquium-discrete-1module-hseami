import data from "./data/preparation-plan.json" with { type: "json" };
export type PlanTarget = { kind: "theory" | "practice"; id: string };
export type PlanItemKind = "learn" | "proof" | "class" | "homework" | "mastery";
export type PlanItem = {
  id: string;
  kind: PlanItemKind;
  label: string;
  targets: PlanTarget[];
};
export type PlanStage = {
  id: string;
  title: string;
  summary: string;
  dependsOn: string[];
  notes: string[];
  items: PlanItem[];
};
export const preparationPlan = data as {
  version: number;
  title: string;
  description: string;
  notes: string[];
  stages: PlanStage[];
};
export type PlanSaved = { version: 1; done: Record<string, boolean> };
export const planStorageKey = "discrete-plan-v1";
export const emptyPlan: PlanSaved = { version: 1, done: {} };
export function loadPlan(): PlanSaved {
  const raw = localStorage.getItem(planStorageKey);
  if (!raw) return emptyPlan;
  const s = JSON.parse(raw);
  if (
    s?.version !== 1 ||
    !s.done ||
    typeof s.done !== "object" ||
    Array.isArray(s.done) ||
    !Object.values(s.done).every((v) => typeof v === "boolean")
  )
    throw Error("Invalid plan progress");
  return s;
}
export function planProgress(
  done: Record<string, boolean>,
  stages: PlanStage[] = preparationPlan.stages,
) {
  const items = stages.flatMap((s) => s.items);
  const completed = items.filter((i) => done[i.id] === true).length;
  return {
    completed,
    total: items.length,
    percent: items.length ? Math.round((completed / items.length) * 100) : 0,
  };
}
export function firstUnfinished(
  done: Record<string, boolean>,
  stages: PlanStage[] = preparationPlan.stages,
) {
  for (const stage of stages) {
    const item = stage.items.find((i) => done[i.id] !== true);
    if (item) return { stage, item };
  }
  return null;
}
