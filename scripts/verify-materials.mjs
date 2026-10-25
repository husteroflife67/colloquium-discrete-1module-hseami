import fs from "node:fs";
import { createHash } from "node:crypto";
import katex from "katex";
const d = JSON.parse(
  fs.readFileSync(new URL("../src/data/practice.json", import.meta.url)),
);
const manifest = JSON.parse(
  fs.readFileSync(
    new URL("../src/data/material-manifest.json", import.meta.url),
  ),
);
const publicRoot = new URL("../public/", import.meta.url);
const assert = (ok, message) => {
  if (!ok) throw Error(message);
};
for (const f of manifest.files) {
  const bytes = fs.readFileSync(
    new URL(`materials/sheets/${f.file}`, publicRoot),
  );
  assert(
    createHash("sha256").update(bytes).digest("hex") === f.sha256,
    `Изменился исходник ${f.file}`,
  );
  for (const n of [...f.classNumbers, ...f.homeworkNumbers])
    assert(
      d.items.some((q) => q.parentNumber === n && q.file === f.file),
      `Не перенесён ${n}`,
    );
}
let formulas = 0;
const ids = new Set();
for (const q of d.items) {
  assert(!ids.has(q.id), `Повтор id ${q.id}`);
  ids.add(q.id);
  for (const image of q.originalImages ?? [q.originalImage])
    assert(
      fs.existsSync(new URL(image.slice(1), publicRoot)),
      `Нет оригинала ${q.number}`,
    );
  for (const s of [
    q.statement,
    q.idea,
    ...q.prerequisites,
    ...q.steps,
    ...q.transitions,
  ]) {
    assert(!/[\x00-\x08\x0e-\x1f]/.test(s), `Повреждённый текст ${q.number}`);
    for (const m of s.matchAll(/\$([^$]+)\$/g)) {
      katex.renderToString(m[1], { throwOnError: true, strict: "error" });
      formulas++;
    }
  }
}
console.log(
  `Проверены ${manifest.files.length} исходных PDF, ${ids.size} карточек и ${formulas} формулы.`,
);
