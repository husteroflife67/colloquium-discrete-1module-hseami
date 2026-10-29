import type { Item, OralQuestion } from "./content/types";
import type { Rating } from "./engine";

export const oralRatingLabels: Record<Rating, string> = {
  unknown: "Не знаю",
  partial: "Частично",
  known: "Знаю",
  repeat: "Повторить",
};

/** Stable order: the chosen fact first, then other questions from its topic.
 * Never synthesizes questions or repeats the same stable question ID. */
export function selectOralQuestions(
  base: Item,
  items: Item[],
  limit = 6,
): OralQuestion[] {
  const cap = Math.max(3, Math.min(6, Math.floor(limit)));
  const questions = [
    ...base.questions,
    ...items
      .filter((item) => item.id !== base.id && item.topic === base.topic)
      .flatMap((item) => item.questions),
  ];
  const seen = new Set<string>();
  return questions
    .filter((q) => {
      if (q.topic !== base.topic || seen.has(q.id)) return false;
      seen.add(q.id);
      return true;
    })
    .slice(0, cap);
}

/** Only explicit self-ratings for questions in this conversation are counted. */
export function oralSummary(
  questions: OralQuestion[],
  sessionRatings: Record<string, Rating>,
) {
  const counts: Record<Rating, number> = {
    unknown: 0,
    partial: 0,
    known: 0,
    repeat: 0,
  };
  const seen = new Set<string>();
  const entries = questions
    .filter((q) => {
      if (seen.has(q.id)) return false;
      seen.add(q.id);
      return Object.hasOwn(sessionRatings, q.id);
    })
    .map((q) => ({ question: q, rating: sessionRatings[q.id] }));
  for (const { rating } of entries) counts[rating]++;
  return { entries, counts, answered: entries.length, total: seen.size };
}
