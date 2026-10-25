import {
  localKeys,
  flatten,
  validCloudRow,
  applyRows,
  type LocalKey,
  type CloudRow,
} from "./sync-model";
export type ProgressBackup = {
  format: "discrete-progress-backup";
  version: 1;
  data: Record<"theory" | "practice" | "plan", unknown>;
};
export function validateBackup(value: unknown): {
  backup: ProgressBackup;
  count: number;
} {
  if (!value || typeof value !== "object") throw Error("Invalid backup");
  const b = value as ProgressBackup;
  if (
    b.format !== "discrete-progress-backup" ||
    b.version !== 1 ||
    !b.data ||
    typeof b.data !== "object" ||
    Array.isArray(b.data)
  )
    throw Error("Invalid backup");
  let count = 0;
  for (const [name, key] of Object.entries(localKeys)) {
    const data = b.data[name as keyof typeof b.data] as any;
    if (data == null) continue;
    if (data.version !== 1) throw Error("Invalid version");
    if (name === "plan") {
      if (
        !data.done ||
        typeof data.done !== "object" ||
        Array.isArray(data.done)
      )
        throw Error("Invalid plan");
    } else if (
      !data.progress ||
      typeof data.progress !== "object" ||
      Array.isArray(data.progress) ||
      !Array.isArray(data.results)
    )
      throw Error("Invalid progress");
    for (const [field, v] of Object.entries(
      flatten(key, JSON.stringify(data)),
    )) {
      if (
        !validCloudRow({
          key: field,
          value: v,
          revision: 1,
          mutation_id: "backup",
        })
      )
        throw Error("Invalid backup value");
      count++;
    }
  }
  return { backup: b, count };
}
export function mergeBackup(
  backup: ProgressBackup,
  cache: Record<LocalKey, string | null>,
) {
  const rows: CloudRow[] = [];
  for (const [name, key] of Object.entries(localKeys)) {
    const data = backup.data[name as keyof typeof backup.data];
    if (data == null) continue;
    const existing = flatten(key, cache[key]);
    for (const [field, value] of Object.entries(
      flatten(key, JSON.stringify(data)),
    ))
      if (!(field in existing))
        rows.push({ key: field, value, revision: 1, mutation_id: "backup" });
  }
  return applyRows(rows, {}, cache);
}
