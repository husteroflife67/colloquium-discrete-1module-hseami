import course from "../data/course.json";
import { practice } from "../practice-model";
import { items } from "../calculus/content";

export type CourseId = "discrete" | "calculus";
export type Material = { course: CourseId; kind: string; id: string; title: string };
export const courses = {
  discrete: { title: "Дискретная математика", subtitle: "1 модуль · 46 вопросов и 145 заданий", start: "course" },
  calculus: { title: "Математический анализ", subtitle: "2 модуль · 87 материалов и 290 уточнений", start: "dashboard" },
};
export const materials: Material[] = [
  ...course.questions.map(q => ({ course: "discrete" as const, kind: "theory", id: q.id, title: `${q.number}. ${q.title}` })),
  ...practice.items.map(q => ({ course: "discrete" as const, kind: "practice", id: q.id, title: `${q.number} · ${q.statement}` })),
  ...items.map(q => ({ course: "calculus" as const, kind: q.kind, id: q.id, title: q.title })),
];
export const materialKey = (m: Pick<Material, "course" | "kind" | "id">) => `${m.course}/${m.kind}/${m.id}`;
export const materialLink = (m: Material) => `#/${m.course}/${m.course === "calculus" ? m.kind : m.kind === "theory" ? "course" : "proofs"}?item=${encodeURIComponent(m.id)}`;
export const findMaterial = (course: string, kind: string, id: string) => materials.find(m => m.course === course && m.kind === kind && m.id === id);
