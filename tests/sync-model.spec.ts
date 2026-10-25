import { test, expect } from "@playwright/test";
import {
  rebaseLocalWrite,
  flatten,
  changesBetween,
  applyRows,
  localKeys,
  validCloudRow,
  type LocalKey,
} from "../src/sync-model";
import { validateBackup, mergeBackup } from "../src/progress-backup";
const cache = () =>
  Object.fromEntries(Object.values(localKeys).map((k) => [k, null])) as Record<
    LocalKey,
    string | null
  >;
test("cloud records preserve false, merge histories by id and do not overwrite pending edits", () => {
  const local = cache();
  local[localKeys.plan] = JSON.stringify({
    version: 1,
    done: { "logic-1": true },
  });
  const rows = [
    { key: "plan/logic-1", value: false, revision: 2, mutation_id: "a" },
    { key: "plan/logic-2", value: true, revision: 1, mutation_id: "b" },
  ];
  const pending = {
    "plan/logic-1": {
      key: "plan/logic-1",
      value: true,
      base_revision: 1,
      mutation_id: "c",
    },
  };
  let out = applyRows(rows, pending, local);
  expect(JSON.parse(out[localKeys.plan]!).done).toEqual({
    "logic-1": true,
    "logic-2": true,
  });
  out = applyRows(rows, {}, local);
  expect(JSON.parse(out[localKeys.plan]!).done["logic-1"]).toBe(false);
  const ticket = {
    id: "ticket1",
    date: "2026-10-25T12:00:00Z",
    questionIds: ["1"],
    ratings: { "1": "known" },
  };
  const resultRow = {
    key: "theory-ticket/ticket1",
    value: ticket,
    revision: 1,
    mutation_id: "a",
  };
  const first = applyRows([resultRow], {}, cache());
  const next = applyRows([resultRow], {}, { ...cache(), ...first });
  expect(next).toEqual({});
});
test("only changed fields are queued; malformed previous cache can be deliberately replaced", () => {
  const before = JSON.stringify({
    version: 1,
    progress: { "1": { status: "known", review: false } },
    results: [],
  });
  const after = JSON.stringify({
    version: 1,
    progress: {
      "1": { status: "known", review: false },
      "2": { status: "learning", review: true },
    },
    results: [],
  });
  expect(
    changesBetween(localKeys.theory, before, after).map(([k]) => k),
  ).toEqual(["theory/2"]);
  expect(
    changesBetween(
      localKeys.plan,
      "broken",
      JSON.stringify({ version: 1, done: { x: false } }),
    ),
  ).toEqual([["plan/x", false]]);
  expect(() =>
    flatten(
      localKeys.plan,
      JSON.stringify({ version: 1, done: { x: "true" } }),
    ),
  ).toThrow();
});
test("backup validation excludes tokens and import adds missing records without replacing current ones", () => {
  const b = {
    format: "discrete-progress-backup",
    version: 1,
    data: {
      theory: {
        version: 1,
        progress: { "1": { status: "known", review: false } },
        results: [],
      },
      practice: { version: 1, progress: { "K1-1": "repeat" }, results: [] },
      plan: { version: 1, done: { "logic-1": true } },
    },
  };
  expect(validateBackup(b).count).toBe(3);
  const local = cache();
  local[localKeys.plan] = JSON.stringify({
    version: 1,
    done: { "logic-1": false },
  });
  const updates = mergeBackup(validateBackup(b).backup, local);
  expect(updates[localKeys.plan]).toBeUndefined();
  expect(JSON.parse(updates[localKeys.practice]!).progress["K1-1"]).toBe(
    "repeat",
  );
  expect(() =>
    validateBackup({ access_token: "not-a-progress-copy" }),
  ).toThrow();
  const bad = structuredClone(b);
  bad.data.practice.progress["K1-1"] = "invalid";
  expect(() => validateBackup(bad)).toThrow();
  expect(
    validCloudRow({
      key: "plan/x",
      value: "false",
      revision: 1,
      mutation_id: "a",
    }),
  ).toBe(false);
});

test("a stale screen cannot overwrite unrelated cloud updates", () => {
  const previous = {
    version: 1,
    progress: { "1": { status: "new", review: false } },
    results: [],
  };
  const current = {
    version: 1,
    progress: {
      "1": { status: "known", review: false },
      "3": { status: "learning", review: true },
    },
    results: [],
  };
  const proposed = {
    ...previous,
    progress: { ...previous.progress, "2": { status: "known", review: false } },
  };
  const rebased = rebaseLocalWrite(
    localKeys.theory,
    previous,
    proposed,
    JSON.stringify(current),
  ) as typeof current;
  expect(rebased.progress).toEqual({
    ...current.progress,
    "2": { status: "known", review: false },
  });
});
