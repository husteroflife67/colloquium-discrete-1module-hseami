import { describe, expect, it } from "vitest";
import { oralSummary, selectOralQuestions } from "./oral";
import type { Item, OralQuestion } from "./content/types";

const q = (id: string, topic = 1) =>
  ({ id, topic, prompt: id }) as OralQuestion;
const item = (id: string, questions: OralQuestion[], topic = 1) =>
  ({ id, topic, questions }) as Item;

describe("oral conversation selection", () => {
  it("starts with the selected fact and adds only unique same-topic existing questions, capped at six", () => {
    const base = item("base", [q("first"), q("duplicate")]);
    const related = item("related", [
      q("duplicate"),
      q("third"),
      q("fourth"),
      q("fifth"),
      q("sixth"),
      q("seventh"),
    ]);
    const unrelated = item("other", [q("wrong-topic", 2)], 2);
    expect(
      selectOralQuestions(base, [unrelated, related, base]).map((v) => v.id),
    ).toEqual(["first", "duplicate", "third", "fourth", "fifth", "sixth"]);
  });
  it("does not invent questions if fewer than three exist", () => {
    const base = item("base", [q("only")]);
    expect(selectOralQuestions(base, [base])).toEqual(base.questions);
  });
});

describe("oral conversation summary", () => {
  it("counts only explicit current-session ratings for selected questions", () => {
    const result = oralSummary([q("a"), q("b"), q("c")], {
      a: "known",
      b: "repeat",
      unrelated: "known",
    });
    expect(result.answered).toBe(2);
    expect(result.total).toBe(3);
    expect(result.counts).toEqual({
      known: 1,
      repeat: 1,
      partial: 0,
      unknown: 0,
    });
    expect(result.entries.map((e) => e.question.id)).toEqual(["a", "b"]);
  });
  it("keeps an unfinished or replayed conversation empty instead of treating prior progress as results", () => {
    expect(oralSummary([q("a"), q("b")], {}).answered).toBe(0);
  });
  it("counts a repeated rating once and uses the final self-rating", () => {
    const ratings = { a: "partial" as const };
    expect(oralSummary([q("a"), q("a")], ratings).counts.partial).toBe(1);
  });
});
