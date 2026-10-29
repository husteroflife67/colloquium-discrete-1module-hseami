import { courses, materialLink, type Material } from "./catalog";
import { studyContent, oralTargets } from "./study-content";
export function materialURL(material: Material, origin: string, base: string, questionId?: string) {
  const url = new URL(base, origin);
  url.hash = materialLink(material).slice(1) + (questionId ? `&question=${encodeURIComponent(questionId)}` : "");
  return url.href;
}
export function feedbackContext(material: Material, questionId?: string) {
  const question = questionId ? oralTargets.get(questionId)?.question : undefined;
  return { title: question?.prompt ?? material.title, excerpt: (question?.answer ?? studyContent(material).answer.join("\n")).slice(0, 300) };
}
export function feedbackBody(material: Material, url: string, description: string, quote: string, questionId?: string) {
  const context = feedbackContext(material, questionId);
  return `Курс: ${courses[material.course].title}\nМатериал: ${context.title.slice(0, 160)}\nID: ${material.id}${questionId ? `; уточнение: ${questionId}` : ""}\nСсылка: ${url}\n\nФрагмент:\n${quote.slice(0, 300)}\n\nЧто нужно исправить:\n${description.slice(0, 600)}`;
}
export function feedbackURL(material: Material, url: string, description: string, quote: string, questionId?: string) {
  const params = new URLSearchParams({ title: `Неточность: ${feedbackContext(material, questionId).title}`.slice(0, 85), body: feedbackBody(material, url, description, quote, questionId) });
  return `https://github.com/husteroflife67/colloquium-discrete-1module-hseami/issues/new?${params}`;
}
