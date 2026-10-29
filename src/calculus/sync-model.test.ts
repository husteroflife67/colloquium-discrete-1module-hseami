import { describe, it, expect } from "vitest";
import { calculusApply, calculusChanges, calculusFlatten, calculusRebase, calculusValidRow, validateQuestions } from "./sync-model";
import { items } from "./content";
import { emptyData, generateTicket } from "./engine";
const fact = items[0], question = fact.questions[0];
describe("calculus progress codec", () => {
  it("roundtrips all legacy fields, independent oral ratings and complete ticket history", () => {
    const data = emptyData(); data.ratings[fact.id] = "partial"; data.drafts[fact.id] = "Черновик"; data.checklists["1"] = [true, false, false, false, false, false, false];
    data.schedules = { [fact.id]: { due: 86400000, intervalDays: 1, streak: 1, lastReviewed: 0, lastRating: "known" } };
    data.history = [{ id: "old-ticket", date: "2026-10-29T01:00:00Z", ticket: generateTicket(items, 3, "uniform", {}, []), scores: [0, 0, 0, 0, 0, 0, 0], base: 0, extra: 0, duration: 30, hints: 0, weak: [fact.id] }];
    const fields = { ...calculusFlatten("predel-v1", JSON.stringify(data)), ...calculusFlatten("predel-v1-questions", JSON.stringify({ [question.id]: "known" })) };
    const rows = Object.entries(fields).map(([key, value]) => ({ key, value, revision: 1, mutation_id: "test" }));
    expect(rows.every(calculusValidRow)).toBe(true);
    const result = calculusApply(rows, {}, {});
    expect(JSON.parse(result["predel-v1"])).toEqual(data);
    expect(JSON.parse(result["predel-v1-questions"])).toEqual({ [question.id]: "known" });
  });
  it("merges a local draft edit with an unrelated cloud rating without overwriting it", () => {
    const before = emptyData(), proposed = emptyData(), live = emptyData();
    proposed.drafts[fact.id] = "Моя работа"; live.ratings[fact.id] = "known";
    expect(calculusRebase("predel-v1", before, proposed, JSON.stringify(live))).toMatchObject({ drafts: { [fact.id]: "Моя работа" }, ratings: { [fact.id]: "known" } });
  });
  it("retains pending local edits and represents deletions explicitly for another device", () => {
    const data = emptyData(); data.ratings[fact.id] = "known";
    const changes = calculusChanges("predel-v1", JSON.stringify(data), JSON.stringify(emptyData()));
    expect(changes).toContainEqual([`rating/${fact.id}`, { deleted: true }]);
    const row = { key: `rating/${fact.id}`, value: { deleted: true }, revision: 2, mutation_id: "reset" };
    expect(calculusApply([row], { [row.key]: { ...row, base_revision: 1 } }, { "predel-v1": JSON.stringify(data) })).toEqual({});
    expect(JSON.parse(calculusApply([row], {}, { "predel-v1": JSON.stringify(data) })["predel-v1"]).ratings).toEqual({});
  });
  it("rejects cross-course IDs, malformed schedules and invalid question ratings", () => {
    expect(calculusValidRow({ key: "rating/K1-1", value: "known", revision: 1, mutation_id: "x" })).toBe(false);
    expect(calculusValidRow({ key: `schedule/${fact.id}`, value: { due: 2 }, revision: 1, mutation_id: "x" })).toBe(false);
    expect(() => validateQuestions({ [question.id]: "admin" })).toThrow();
  });
});
