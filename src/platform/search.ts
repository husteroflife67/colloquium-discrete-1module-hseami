import course from "../data/course.json" with { type: "json" };
import { practice } from "../practice-model";
import { items } from "../calculus/content";
import { materials, materialKey, materialLink, type Material, type CourseId } from "./catalog";
import { studyContent } from "./study-content";

export type SearchKind = "definition" | "theory" | "practice" | "oral";
export type SearchDocument = { key: string; material: Material; kind: SearchKind; title: string; body: string; topic: string; href: string };
export const normalize = (text: string) => text.toLocaleLowerCase("ru-RU").replaceAll("ё", "е");
export function plainText(text: string) {
  let value = text.replace(/\$+/g, "").replace(/\\mathbb\{([RNQZ])\}/g, (_, key: string) => ({ R: "ℝ", N: "ℕ", Q: "ℚ", Z: "ℤ" })[key as "R"]);
  for (let n = 0; n < 4; n++) value = value.replace(/\\frac\{([^{}]*)\}\{([^{}]*)\}/g, "($1)/($2)").replace(/\\sqrt\{([^{}]*)\}/g, "√($1)");
  const symbols: Record<string, string> = { forall: "∀", exists: "∃", varepsilon: "ε", epsilon: "ε", delta: "δ", alpha: "α", beta: "β", infty: "∞", to: "→", rightarrow: "→", leq: "≤", le: "≤", geq: "≥", ge: "≥", neq: "≠", in: "∈", subseteq: "⊆", subset: "⊂", cup: "∪", cap: "∩", land: "∧", lor: "∨", neg: "¬", implies: "⇒", iff: "⇔", cdot: "·", times: "×", sum: "∑", ldots: "…", dots: "…", left: "", right: "", mathbb: "", text: "", operatorname: "" };
  return value.replace(/\\([A-Za-z]+)/g, (_, command: string) => symbols[command] ?? command).replace(/\\[,;! ]/g, " ").replace(/[{}]/g, "").replace(/\s+/g, " ").trim();
}
export const searchDocuments: SearchDocument[] = materials.flatMap(m => {
  const content = studyContent(m);
  let extra = "";
  if (m.course === "discrete" && m.kind === "theory") {
    const q = course.questions.find(q => q.id === m.id)!;
    extra = [q.number, q.short, q.explanation, q.proof, q.example].join(" ");
  } else if (m.course === "discrete") {
    const q = practice.items.find(q => q.id === m.id)!;
    extra = [q.number, ...q.prerequisites, ...q.steps, ...q.transitions, q.idea].join(" ");
  } else {
    const i = items.find(i => i.id === m.id)!;
    extra = [...i.board, ...i.mistakes, ...(i.supplements ?? []).flatMap(s => [s.title, s.idea, ...s.proof])].join(" ");
  }
  const base: SearchDocument = { key: materialKey(m), material: m, kind: m.kind as SearchKind, title: m.title, body: plainText([content.prompt, ...content.answer, content.hint, ...content.example, extra].join(" ")), topic: content.topic, href: materialLink(m) };
  const oral: SearchDocument[] = m.course === "calculus" ? items.find(i => i.id === m.id)!.questions.map(q => ({ key: `${base.key}/oral/${q.id}`, material: m, kind: "oral", title: q.prompt, body: plainText([q.hint, q.answer, q.criteria, q.mistake].join(" ")), topic: content.topic, href: `${materialLink(m)}&question=${encodeURIComponent(q.id)}` })) : [];
  return [base, ...oral];
});
const indexed = searchDocuments.map(doc => ({ doc, title: normalize(plainText(doc.title)), body: normalize(doc.body), topic: normalize(doc.topic) }));
export function searchAll(query: string, courseId: "all" | CourseId = "all", kind: "all" | SearchKind = "all") {
  const terms = normalize(query.trim().slice(0, 200)).split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  return indexed.filter(({ doc, title, body, topic }) => (courseId === "all" || doc.material.course === courseId) && (kind === "all" || doc.kind === kind) && terms.every(term => `${title} ${topic} ${body}`.includes(term)))
    .map(entry => ({ ...entry, score: terms.reduce((sum, term) => sum + (entry.title.includes(term) ? 8 : 0) + (entry.topic.includes(term) ? 2 : 0), 0) }))
    .sort((a, b) => b.score - a.score || a.doc.title.localeCompare(b.doc.title, "ru"))
    .map(({ doc }) => {
      const position = Math.max(0, ...terms.map(term => normalize(doc.body).indexOf(term)).filter(n => n >= 0).slice(0, 1));
      const start = Math.max(0, position - 65);
      return { ...doc, snippet: `${start ? "…" : ""}${doc.body.slice(start, start + 240)}${doc.body.length > start + 240 ? "…" : ""}` };
    });
}
