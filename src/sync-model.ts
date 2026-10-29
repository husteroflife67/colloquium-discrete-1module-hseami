export const localKeys = {
  theory: "discrete-study-v1",
  practice: "discrete-practice-v1",
  plan: "discrete-plan-v1",
} as const;
export type LocalKey = string;
export type CloudValue = boolean | string | Record<string, unknown>;
export type CloudRow = {
  key: string;
  value: CloudValue;
  revision: number;
  mutation_id: string;
};
export type Mutation = {
  key: string;
  value: CloudValue;
  base_revision: number;
  mutation_id: string;
};
export type Conflict = {
  key: string;
  local: CloudValue;
  remote: CloudValue;
  revision: number;
};
export type Journal = {
  version: 1;
  owner: string | null;
  revisions: Record<string, number>;
  pending: Record<string, Mutation>;
  conflicts: Record<string, Conflict>;
};
export const journalKey = "discrete-sync-v1";
export const newJournal = (): Journal => ({
  version: 1,
  owner: null,
  revisions: {},
  pending: {},
  conflicts: {},
});
export function readJournal(): Journal {
  const raw = localStorage.getItem(journalKey);
  if (!raw) return newJournal();
  const j = JSON.parse(raw);
  if (
    j?.version !== 1 ||
    (j.owner !== null && typeof j.owner !== "string") ||
    !j.revisions ||
    !j.pending ||
    !j.conflicts
  )
    throw Error("Invalid sync journal");
  return j;
}
export function flatten(
  key: string,
  raw: string | null,
): Record<string, CloudValue> {
  if (!raw) return {};
  const data = JSON.parse(raw);
  if (data?.version !== 1) throw Error("Invalid progress version");
  const out: Record<string, CloudValue> = {};
  if (key === localKeys.plan) {
    for (const [id, v] of Object.entries(data.done ?? {})) {
      if (typeof v !== "boolean") throw Error("Invalid plan value");
      out[`plan/${id}`] = v;
    }
  } else if (key === localKeys.theory || key === localKeys.practice) {
    const prefix = key === localKeys.theory ? "theory" : "practice";
    for (const [id, value] of Object.entries(data.progress ?? {}))
      out[`${prefix}/${id}`] = value as CloudValue;
    for (const result of data.results ?? [])
      out[`${prefix}-ticket/${result.id}`] = result;
  }
  for (const [field, value] of Object.entries(out))
    if (
      !validCloudRow({ key: field, value, revision: 1, mutation_id: "cached" })
    )
      throw Error("Invalid cached progress");
  return out;
}
export function changesBetween(
  key: string,
  before: string | null,
  after: string,
) {
  let a: Record<string, CloudValue> = {};
  try {
    a = flatten(key, before);
  } catch {
    /* A deliberate save replaces an unreadable legacy cache. */
  }
  const b = flatten(key, after);
  return Object.entries(b).filter(
    ([id, v]) => JSON.stringify(a[id]) !== JSON.stringify(v),
  );
}
export function validCloudRow(row: unknown): row is CloudRow {
  if (!row || typeof row !== "object") return false;
  const r = row as CloudRow;
  if (
    typeof r.key !== "string" ||
    !/^(theory|practice|plan|theory-ticket|practice-ticket)\/[A-Za-z0-9_.-]{1,100}$/.test(
      r.key,
    ) ||
    !Number.isSafeInteger(r.revision) ||
    r.revision < 1 ||
    typeof r.mutation_id !== "string"
  )
    return false;
  const [type, id] = r.key.split("/"),
    v = r.value;
  if (type === "plan") return typeof v === "boolean";
  if (type === "practice")
    return (
      typeof v === "string" &&
      ["unseen", "working", "independent", "repeat"].includes(v)
    );
  if (!v || typeof v !== "object" || Array.isArray(v)) return false;
  if (type === "theory")
    return (
      ["new", "learning", "known"].includes(v.status as string) &&
      typeof v.review === "boolean"
    );
  const ids = v[type === "theory-ticket" ? "questionIds" : "itemIds"];
  const ratings = v.ratings;
  return (
    v.id === id &&
    typeof v.date === "string" &&
    Number.isFinite(Date.parse(v.date)) &&
    Array.isArray(ids) &&
    ids.every((i) => typeof i === "string") &&
    !!ratings &&
    typeof ratings === "object" &&
    ids.every((i) => {
      const rating = (ratings as Record<string, unknown>)[i];
      return (
        type === "theory-ticket"
          ? ["forgot", "repeat", "known"]
          : ["unseen", "working", "independent", "repeat"]
      ).includes(rating as string);
    })
  );
}
export function applyRows(
  rows: CloudRow[],
  pending: Record<string, Mutation>,
  cache: Record<LocalKey, string | null>,
) {
  const changed = new Set<LocalKey>();
  const parsed: Partial<Record<LocalKey, any>> = {};
  for (const row of rows) {
    if (!validCloudRow(row)) throw Error("Invalid cloud progress");
    if (pending[row.key]) continue;
    const [type, id] = row.key.split("/");
    const key =
      type === "plan"
        ? localKeys.plan
        : type.startsWith("theory")
          ? localKeys.theory
          : localKeys.practice;
    const data =
      parsed[key] ??
      (parsed[key] = cache[key]
        ? JSON.parse(cache[key]!)
        : type === "plan"
          ? { version: 1, done: {} }
          : { version: 1, progress: {}, results: [] });
    if (type === "plan") data.done = { ...data.done, [id]: row.value };
    else if (type.endsWith("-ticket")) {
      const results = [...(data.results ?? [])];
      const index = results.findIndex((r: any) => r.id === id);
      if (index < 0) results.push(row.value);
      else results[index] = row.value;
      data.results = results.sort(
        (a: any, b: any) => Date.parse(b.date) - Date.parse(a.date),
      );
    } else data.progress = { ...data.progress, [id]: row.value };
    changed.add(key);
  }
  const output: Partial<Record<LocalKey, string>> = {};
  for (const key of changed) {
    const raw = JSON.stringify(parsed[key]);
    if (raw !== cache[key]) output[key] = raw;
  }
  return output;
}

// Apply only intentional UI edits to the latest cache; a stale React render must
// not write old values over unrelated records just received from another device.
export function rebaseLocalWrite(
  key: string,
  previous: unknown,
  proposed: unknown,
  current: string | null,
): unknown {
  if (!previous || !current) return proposed;
  let live: any;
  try {
    live = JSON.parse(current);
    if (live.version !== 1) return proposed;
    flatten(key, current);
  } catch {
    return proposed;
  }
  const before = flatten(key, JSON.stringify(previous));
  const after = flatten(key, JSON.stringify(proposed));
  const rows: CloudRow[] = Object.entries(after)
    .filter(
      ([field, value]) =>
        JSON.stringify(before[field]) !== JSON.stringify(value),
    )
    .map(([field, value]) => ({
      key: field,
      value,
      revision: 1,
      mutation_id: "local-edit",
    }));
  const cache = Object.fromEntries(
    Object.values(localKeys).map((k) => [k, k === key ? current : null]),
  ) as Record<LocalKey, string | null>;
  const updates = applyRows(rows, {}, cache);
  return updates[key as LocalKey]
    ? JSON.parse(updates[key as LocalKey]!)
    : live;
}
