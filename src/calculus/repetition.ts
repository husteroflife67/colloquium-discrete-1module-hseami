import type { Item } from "./content/types";
import type { Rating } from "./engine";

export type ReviewSchedule = {
  due: number;
  intervalDays: number;
  streak: number;
  lastReviewed: number;
  lastRating: Rating;
};

export const DAY = 24 * 60 * 60 * 1000;
export const KNOWN_INTERVALS = [1, 3, 7, 14, 30] as const;

/** Fixed elapsed-time intervals; no calendar/timezone rounding. Revealing is not a review. */
export function scheduleReview(
  previous: ReviewSchedule | undefined,
  rating: Rating,
  now: number,
): ReviewSchedule {
  if (!Number.isFinite(now) || now < 0)
    throw Error("Некорректное время повторения");
  if (!["unknown", "partial", "known", "repeat"].includes(rating))
    throw Error("Некорректная самооценка");
  const streak =
    rating === "known"
      ? Math.min(
          (previous?.lastRating === "known" ? previous.streak : 0) + 1,
          KNOWN_INTERVALS.length,
        )
      : 0;
  const intervalDays =
    rating === "known"
      ? KNOWN_INTERVALS[Math.min(streak - 1, KNOWN_INTERVALS.length - 1)]
      : rating === "unknown"
        ? 10 / (24 * 60)
        : 1;
  return {
    due: now + intervalDays * DAY,
    intervalDays,
    streak,
    lastReviewed: now,
    lastRating: rating,
  };
}

function definitionNumber(item: Item): number | undefined {
  const number = (item as Item & { definitionNumber?: number })
    .definitionNumber;
  return typeof number === "number" && Number.isFinite(number)
    ? number
    : undefined;
}

/** New supplemental definitions and non-required facts are opt-in via an existing schedule. */
function eligibleNew(item: Item) {
  return item.kind === "definition"
    ? definitionNumber(item) !== undefined
    : item.required;
}

/** Oldest due first, then unseen course definitions (course order), then other required material. */
export function dueItems(
  items: Item[],
  schedules: Record<string, ReviewSchedule>,
  now: number,
): Item[] {
  return items
    .filter((item) => {
      const schedule = schedules[item.id];
      return schedule ? schedule.due <= now : eligibleNew(item);
    })
    .sort((a, b) => {
      const sa = schedules[a.id];
      const sb = schedules[b.id];
      if (sa && sb) return sa.due - sb.due || a.id.localeCompare(b.id);
      if (sa) return -1;
      if (sb) return 1;
      const da = definitionNumber(a);
      const db = definitionNumber(b);
      if (da !== undefined && db !== undefined)
        return da - db || a.id.localeCompare(b.id);
      if (da !== undefined) return -1;
      if (db !== undefined) return 1;
      return a.topic - b.topic;
    });
}

/** Validation for optional schema-v1 import fields; accepts only schedules this algorithm can produce. */
export function isReviewSchedule(value: unknown): value is ReviewSchedule {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const s = value as ReviewSchedule;
  if (
    !Number.isFinite(s.due) ||
    s.due < 0 ||
    !Number.isFinite(s.lastReviewed) ||
    s.lastReviewed < 0 ||
    !Number.isFinite(s.intervalDays) ||
    s.intervalDays <= 0 ||
    !Number.isSafeInteger(s.streak) ||
    s.streak < 0 ||
    s.streak > KNOWN_INTERVALS.length ||
    !["unknown", "partial", "known", "repeat"].includes(s.lastRating)
  )
    return false;
  const expectedDays =
    s.lastRating === "known"
      ? KNOWN_INTERVALS[Math.min(s.streak - 1, KNOWN_INTERVALS.length - 1)]
      : s.lastRating === "unknown"
        ? 10 / (24 * 60)
        : 1;
  return (
    (s.lastRating === "known" ? s.streak >= 1 : s.streak === 0) &&
    s.intervalDays === expectedDays &&
    s.due >= s.lastReviewed &&
    Math.abs(s.due - (s.lastReviewed + s.intervalDays * DAY)) < 0.001
  );
}
