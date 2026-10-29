import { describe, expect, it } from "vitest";
import { DAY, dueItems, scheduleReview, isReviewSchedule } from "./repetition";
import type { ReviewSchedule } from "./repetition";
import type { Item } from "./content/types";

const now = Date.UTC(2026, 9, 28, 9);
const item = (
  id: string,
  kind: Item["kind"],
  number?: number,
  required = true,
): Item =>
  ({
    id,
    kind,
    topic: 1,
    required,
    definitionNumber: number,
  }) as Item;

describe("spaced repetition", () => {
  it("expands consecutive successful recalls through 1,3,7,14,30 days and caps at 30", () => {
    let previous: ReviewSchedule | undefined;
    let reviewedAt = now;
    [1, 3, 7, 14, 30, 30].forEach((days, index) => {
      previous = scheduleReview(previous, "known", reviewedAt);
      expect(previous.intervalDays).toBe(days);
      expect(previous.due).toBe(reviewedAt + days * DAY);
      expect(previous.streak).toBe(Math.min(index + 1, 5));
      expect(previous.lastReviewed).toBe(reviewedAt);
      reviewedAt = previous.due;
    });
  });

  it("retries unknown in exactly ten minutes and resets an established streak", () => {
    const a = scheduleReview(undefined, "known", now);
    const b = scheduleReview(a, "known", a.due);
    const missed = scheduleReview(b, "unknown", b.due);
    expect(missed.streak).toBe(0);
    expect(missed.due - missed.lastReviewed).toBe(10 * 60 * 1000);
    expect(scheduleReview(missed, "known", missed.due).intervalDays).toBe(1);
  });

  it.each(["partial", "repeat"] as const)(
    "%s schedules one day and resets the known sequence",
    (rating) => {
      const previous = scheduleReview(
        scheduleReview(undefined, "known", now),
        "known",
        now,
      );
      const result = scheduleReview(previous, rating, now);
      expect(result.due).toBe(now + DAY);
      expect(result.streak).toBe(0);
      expect(result.lastRating).toBe(rating);
      expect(scheduleReview(result, "known", result.due).intervalDays).toBe(1);
    },
  );

  it("includes an item exactly at its deadline but not one millisecond before", () => {
    const card = item("def-a", "definition", 1);
    const schedule = scheduleReview(undefined, "known", now);
    expect(dueItems([card], { "def-a": schedule }, schedule.due - 1)).toEqual(
      [],
    );
    expect(dueItems([card], { "def-a": schedule }, schedule.due)).toEqual([
      card,
    ]);
  });

  it("prioritizes overdue material then new official definitions by course number", () => {
    const a = item("late", "theory");
    const b = item("oldest", "practice");
    const def9 = item("def9", "definition", 9);
    const def2 = item("def2", "definition", 2);
    const theory = item("new-theory", "theory");
    const schedules = {
      late: scheduleReview(undefined, "unknown", now - 1000000),
      oldest: scheduleReview(undefined, "unknown", now - 2000000),
    };
    const input = [theory, def9, a, def2, b];
    expect(dueItems(input, schedules, now).map((i) => i.id)).toEqual([
      "oldest",
      "late",
      "def2",
      "def9",
      "new-theory",
    ]);
    expect(input.map((i) => i.id)).toEqual([
      "new-theory",
      "def9",
      "late",
      "def2",
      "oldest",
    ]);
  });

  it("excludes new supplementary definitions and no-proof facts while retaining scheduled ones", () => {
    const supplement = item("supplement", "definition");
    const noProof = item("riemann", "theory", undefined, false);
    expect(dueItems([supplement, noProof], {}, now)).toEqual([]);
    const schedule = scheduleReview(undefined, "unknown", now - 1000000);
    expect(
      dueItems(
        [supplement, noProof],
        { supplement: schedule, riemann: schedule },
        now,
      ),
    ).toHaveLength(2);
  });

  it("does not mutate the previous schedule and rejects invalid time", () => {
    const previous = scheduleReview(undefined, "known", now);
    const before = { ...previous };
    scheduleReview(previous, "partial", now + DAY);
    expect(previous).toEqual(before);
    expect(() => scheduleReview(previous, "known", NaN)).toThrow();
    expect(() => scheduleReview(previous, "known", -1)).toThrow();
  });
});

describe("schedule import validation", () => {
  it.each(["known", "partial", "unknown", "repeat"] as const)(
    "accepts generated %s schedules and rejects contradictory fields",
    (rating) => {
      const schedule = scheduleReview(undefined, rating, now);
      expect(isReviewSchedule(JSON.parse(JSON.stringify(schedule)))).toBe(true);
      expect(isReviewSchedule({ ...schedule, due: schedule.due + 1000 })).toBe(
        false,
      );
      expect(isReviewSchedule({ ...schedule, lastReviewed: NaN })).toBe(false);
      expect(isReviewSchedule({ ...schedule, intervalDays: -1 })).toBe(false);
      expect(
        isReviewSchedule({ ...schedule, streak: rating === "known" ? 0 : 1 }),
      ).toBe(false);
    },
  );
  it("rejects missing fields, arrays and invalid rating", () => {
    expect(isReviewSchedule(null)).toBe(false);
    expect(isReviewSchedule([])).toBe(false);
    expect(isReviewSchedule({})).toBe(false);
    expect(
      isReviewSchedule({
        ...scheduleReview(undefined, "known", now),
        lastRating: "excellent",
      }),
    ).toBe(false);
  });
});
