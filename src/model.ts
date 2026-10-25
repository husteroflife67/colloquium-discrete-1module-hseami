export type Status = "new" | "learning" | "known";
export type Rating = "forgot" | "repeat" | "known";
export type Entry = { status: Status; review: boolean };
export type Result = {
  id: string;
  date: string;
  questionIds: string[];
  ratings: Record<string, Rating>;
};
export type Saved = {
  version: 1;
  progress: Record<string, Entry>;
  results: Result[];
};
export const storageKey = "discrete-study-v1";
export const emptySaved: Saved = { version: 1, progress: {}, results: [] };
export function readSaved(): Saved {
  const raw = localStorage.getItem(storageKey);
  if (!raw) return emptySaved;
  const s = JSON.parse(raw);
  if (s.version !== 1 || !s.progress || !Array.isArray(s.results))
    throw Error("Invalid storage");
  for (const e of Object.values(s.progress) as Entry[])
    if (
      !e ||
      !["new", "learning", "known"].includes(e.status) ||
      typeof e.review !== "boolean"
    )
      throw Error("Invalid entry");
  for (const r of s.results)
    if (
      typeof r.id !== "string" ||
      typeof r.date !== "string" ||
      !Array.isArray(r.questionIds) ||
      !r.questionIds.every((id: unknown) => typeof id === "string") ||
      !r.ratings ||
      !r.questionIds.every((id: string) =>
        ["forgot", "repeat", "known"].includes(r.ratings[id]),
      )
    )
      throw Error("Invalid result");
  return s;
}
export function sample<T>(items: T[], count: number): T[] {
  if (!Number.isInteger(count) || count < 1)
    throw Error("Укажите целое количество вопросов от 1.");
  if (count > items.length)
    throw Error(
      `В выбранных темах только ${items.length} вопросов. Уменьшите количество или добавьте темы.`,
    );
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, count);
}
export function ratedEntry(r: Rating): Entry {
  return {
    status: r === "known" ? "known" : r === "repeat" ? "learning" : "new",
    review: r !== "known",
  };
}
