import fs from "node:fs";
import { createHash } from "node:crypto";
const manifest = JSON.parse(fs.readFileSync("docs/platform-source-manifest.json", "utf8"));
for (const file of manifest.files) {
  const hash = createHash("sha256").update(fs.readFileSync(file.path)).digest("hex");
  if (hash !== file.sha256) throw Error(`Изменился исходник: ${file.path}`);
}
console.log(`Побайтно сохранены ${manifest.files.length} файлов источников обоих курсов.`);
