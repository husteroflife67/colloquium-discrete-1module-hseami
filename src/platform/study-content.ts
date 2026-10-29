import course from "../data/course.json" with { type: "json" };
import { practice } from "../practice-model";
import { items, topics } from "../calculus/content";
import { materialKey, materials, type Material } from "./catalog";

export type StudyContent = {
  prompt: string; answer: string[]; hint: string; example: string[];
  note: string; topic: string; source?: { title: string; path: string };
};
export function studyContent(m: Material): StudyContent {
  if (m.course === "calculus") {
    const i = items.find(i => i.id === m.id)!;
    return {
      prompt: i.kind === "definition" ? i.officialPrompt ?? `Сформулируйте: ${i.title}` : i.statement,
      answer: [i.statement, ...i.proof], hint: i.idea || i.board.join("\n"), example: i.examples,
      note: `${i.origin === "generated" ? "Авторский разбор" : "Материал курса"} · ${i.source}`,
      topic: topics.find(t => t.id === i.topic)?.title ?? "Матанализ",
      source: i.references?.[0] ? { title: i.references[0].title, path: `${i.references[0].path}#page=${i.references[0].page}` } : undefined,
    };
  }
  if (m.kind === "theory") {
    const q = course.questions.find(q => q.id === m.id)!;
    return { prompt: q.title, answer: [q.short, q.explanation, q.proof].filter(Boolean), hint: q.short, example: [q.example].filter(Boolean), topic: course.topics.find(t => t.id === q.topicId)?.title ?? "Дискретная математика", note: "Учебная адаптация конспекта М. Н. Вялого", source: { title: `Конспект · стр. ${q.sourcePage}`, path: `materials/DMlec-base.pdf#page=${q.sourcePage}` } };
  }
  const q = practice.items.find(q => q.id === m.id)!;
  return { prompt: q.statement, answer: q.steps.length ? q.steps : [q.solutionOrigin === "source" ? "Доказательство доступно в исходном конспекте по ссылке ниже." : "Готового надёжного решения нет. Сверьтесь с оригиналом и материалом курса."], hint: q.idea || q.prerequisites.join("\n"), example: q.transitions, topic: practice.topics.find(t => t.id === q.topicId)?.title ?? "Практика", note: q.solutionNote, source: { title: `${q.file} · стр. ${q.sourceProofPage ?? q.page}`, path: (q.source === "lecture" ? `materials/DMlec-base.pdf#page=${q.sourceProofPage ?? q.page}` : q.sourceUrl.replace(/^\//, "")) } };
}
export const oralTargets = new Map(items.flatMap(i => i.questions.map(q => [q.id, { material: materials.find(m => m.course === "calculus" && m.id === i.id)!, question: q }] as const)));
export const materialByKey = new Map(materials.map(m => [materialKey(m), m]));
