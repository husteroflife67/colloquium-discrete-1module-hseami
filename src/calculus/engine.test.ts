import { describe, it, expect } from "vitest";
import { items } from "./content";
import { scheduleReview } from "./repetition";
import {
  baseScore,
  availableExtra,
  chooseExtra,
  generateTicket,
  validateImport,
  emptyData,
  timerState,
} from "./engine";
describe("ticket rules", () => {
  it("scores sum to eight and enforce half points", () => {
    expect(baseScore([0.5, 0.5, 0.5, 0.5, 1, 3, 2])).toBe(8);
    expect(() => baseScore([0.5, 0.5, 0.5, 0.5, 1, 3, 2.5])).toThrow();
    expect(() => baseScore([0.2, 0, 0, 0, 0, 0, 0])).toThrow();
  });
  it("extra thresholds 6,6.5,8 and irreversible selection", () => {
    expect(availableExtra(6)).toEqual([1]);
    expect(availableExtra(6.5)).toEqual([1, 2]);
    expect(availableExtra(8)).toEqual([1, 2]);
    expect(() => chooseExtra(null, 2, 6)).toThrow();
    expect(chooseExtra(null, 2, 6.5)).toBe(2);
    expect(() => chooseExtra(1, 2, 8)).toThrow();
  });
  it("seeded tickets are repeatable and exclude no-proof facts", () => {
    for (let seed = 0; seed < 200; seed++) {
      const t = generateTicket(items, seed, "uniform", {}, []);
      expect(t).toEqual(generateTicket(items, seed, "uniform", {}, []));
      expect(new Set(t.definitionIds).size).toBe(4);
      expect(
        t.definitionIds.every(
          (id) =>
            items.find((i) => i.id === id)?.definitionNumber !== undefined,
        ),
      ).toBe(true);
      expect(items.find((i) => i.id === t.theoryId)?.required).toBe(true);
      expect(t.taskId).not.toBe(t.shortId);
    }
  });
  it("selection applies to every component", () => {
    const t = generateTicket(items, 25, "selected", {}, [1, 2]);
    expect(
      [...t.definitionIds, t.theoryId, t.taskId, t.shortId].every((id) =>
        [1, 2].includes(items.find((i) => i.id === id)!.topic),
      ),
    ).toBe(true);
  });
  it("weak prioritizes unmastered objects", () => {
    const defs = items.filter((i) => i.kind === "definition");
    const ratings = Object.fromEntries(
      defs.slice(0, -4).map((i) => [i.id, "known" as const]),
    );
    const t = generateTicket(items, 9, "weak", ratings, []);
    expect(t.definitionIds.every((id) => !ratings[id])).toBe(true);
  });
});
describe("timing", () => {
  it("calls definitions after 25 minutes and caps shared budget to30", () => {
    expect(timerState(1500, "prep", 0, false).next).toBe("definitions");
    expect(timerState(1740, "definitions", 1500, false).remaining).toBe(60);
    expect(timerState(1800, "prep", 0, true).next).toBe("second");
  });
  it("returns saved definition minutes to preparation", () => {
    expect(timerState(420, "prep", 420, true).remaining).toBe(1380);
    expect(timerState(600, "definitions", 300, false).next).toBe("prep");
  });
  it("enforces second/extra/global limits", () => {
    expect(timerState(2700, "second", 300, true).next).toBe("grade");
    expect(timerState(4200, "extraSolve", 3000, true).next).toBe("extraAnswer");
    expect(timerState(4800, "extraAnswer", 4200, true).next).toBe("grade");
    expect(timerState(7200, "extraAnswer", 7100, true).limit).toBe(true);
  });
});
describe("persistence import", () => {
  it("сохраняет старую историю со вспомогательными определениями и новые расписания", () => {
    const d = emptyData();
    const t = generateTicket(items, 4, "uniform", {}, []);
    t.definitionIds = [
      "def-decimal",
      "def-bounds",
      "def-nested",
      "def-monotone",
    ];
    d.history = [
      {
        id: "legacy",
        date: "2026-10-26T12:00:00Z",
        ticket: t,
        scores: [0, 0, 0, 0, 0, 0, 0],
        base: 0,
        extra: 0,
        duration: 20,
        hints: 0,
        weak: [],
      },
    ];
    d.ratings["def-bounds"] = "known";
    d.drafts["def-nested"] = "Старый черновик";
    const ids = new Set(items.map((i) => i.id));
    expect(validateImport(JSON.parse(JSON.stringify(d)), ids, items)).toEqual(
      d,
    );
    d.schedules = {
      "def-bounds": scheduleReview(undefined, "known", Date.UTC(2026, 9, 29)),
    };
    expect(validateImport(JSON.parse(JSON.stringify(d)), ids, items)).toEqual(
      d,
    );
    d.schedules["def-bounds"].due += 1000;
    expect(() => validateImport(d, ids, items)).toThrow();
  });
  const ids = new Set(items.map((i) => i.id));
  it("roundtrips progress and drafts", () => {
    const d = emptyData();
    d.ratings[items[0].id] = "known";
    d.drafts[items[0].id] = "Мой ответ";
    expect(validateImport(JSON.parse(JSON.stringify(d)), ids)).toEqual(d);
  });
  it("rejects malformed schema unknown IDs and impossible scores", () => {
    expect(() => validateImport({ schemaVersion: 2 }, ids)).toThrow();
    const d = emptyData();
    d.ratings["invented"] = "known";
    expect(() => validateImport(d, ids)).toThrow();
    const h = emptyData();
    h.history = [
      {
        id: "1",
        date: new Date().toISOString(),
        ticket: generateTicket(items, 42, "uniform", {}, []),
        scores: [0, 0, 0, 0, 0, 0, 0],
        base: 8,
        extra: 0,
        duration: 2,
        hints: 0,
        weak: [],
      },
    ];
    expect(() => validateImport(h, ids)).toThrow();
  });
});
