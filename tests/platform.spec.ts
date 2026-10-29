import { test, expect } from "@playwright/test";
import { items } from "../src/calculus/content";
import { emptyData, generateTicket } from "../src/calculus/engine";
import { preparationPlan } from "../src/plan-model";
const fact = items.find(i => i.definitionNumber === 1)!;
const question = fact.questions[0];
const planId = preparationPlan.stages[0].items[0].id;
function fixtures() {
  const calculus = emptyData(); calculus.ratings[fact.id] = "known"; calculus.drafts[fact.id] = "Старый черновик";
  calculus.checklists["1"] = [true, false, false, false, false, false, false];
  calculus.history = [{ id: "legacy-calculus", date: "2026-10-28T10:00:00Z", ticket: generateTicket(items, 15, "uniform", {}, []), scores: [0, 0, 0, 0, 0, 0, 0], base: 0, extra: 0, duration: 50, hints: 0, weak: [fact.id] }];
  return {
    "discrete-study-v1": { version: 1, progress: { "1": { status: "known", review: false } }, results: [{ id: "legacy-discrete", date: "2026-10-28T12:00:00Z", questionIds: ["2"], ratings: { "2": "repeat" } }] },
    "discrete-practice-v1": { version: 1, progress: { "K3-1": "independent" }, results: [] },
    "discrete-plan-v1": { version: 1, done: { [planId]: true } },
    "predel-v1": calculus,
    "predel-v1-questions": { [question.id]: "partial" },
  };
}
test("old progress is detected across courses, sources are available, and switching does not reset data", async ({ page, request }) => {
  const seed = fixtures();
  await page.addInitScript(seed => { for (const [key, data] of Object.entries(seed)) localStorage.setItem(key, JSON.stringify(data)); }, seed);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Продолжить подготовку" })).toBeVisible();
  await expect(page.locator(".platform-card").first()).toContainText("1 / 46");
  await expect(page.locator(".platform-card").nth(1)).toContainText("1 / 87");
  await page.getByLabel("Выбрать курс").selectOption("calculus");
  await expect(page.locator(".sidebar")).toContainText("Устный экзаменатор");
  await page.getByLabel("Выбрать курс").selectOption("discrete");
  await expect(page.locator(".sidebar")).toContainText("План подготовки");
  const saved = await page.evaluate(keys => Object.fromEntries(keys.map(key => [key, JSON.parse(localStorage.getItem(key)!)])), Object.keys(seed));
  expect(saved).toEqual(seed);
  for (const path of ["sources/definitions.pdf", "sources/notes.pdf", "sources/program.pdf", "sources/corrected-guide.pdf", "materials/DMlec-base.pdf"]) expect((await request.get(path)).ok()).toBeTruthy();
});
test("bookmarks from both courses persist and open the precise card", async ({ page }) => {
  await page.goto("/#/discrete/course?item=1");
  await page.getByRole("button", { name: "☆ В закладки" }).click();
  await page.goto(`/#/calculus/definition?item=${fact.id}`);
  await page.getByRole("button", { name: "☆ В закладки" }).click();
  await page.getByRole("link", { name: "Закладки", exact: true }).click();
  await expect(page.locator(".platform-list > li")).toHaveCount(2);
  await page.reload();
  await expect(page.locator(".platform-list > li")).toHaveCount(2);
  await page.locator(".platform-list > li").last().getByRole("link").click();
  await expect(page.locator(".reading")).toContainText(fact.title);
  await expect(page.getByRole("button", { name: "★ Убрать из закладок" })).toHaveAttribute("aria-pressed", "true");
});
test("journal uses saved ticket self-ratings from each course without changing old history", async ({ page }) => {
  const seed = fixtures();
  await page.addInitScript(seed => { for (const [key, data] of Object.entries(seed)) localStorage.setItem(key, JSON.stringify(data)); }, seed);
  await page.goto("/#/mistakes");
  await expect(page.locator(".platform-list > li")).toHaveCount(2);
  await page.getByLabel("Фильтр курса").selectOption("calculus");
  await expect(page.locator(".platform-list > li")).toHaveCount(1);
  await page.locator(".platform-list a").click();
  await expect(page.locator(".reading")).toContainText(fact.title);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("predel-v1")!).history)).toEqual(seed["predel-v1"].history);
});
test("legacy import previews conflicts, preserves both histories and question ratings, then exports all courses", async ({ page }) => {
  const seed = fixtures();
  await page.addInitScript(seed => { for (const [key, data] of Object.entries(seed)) localStorage.setItem(key, JSON.stringify(data)); }, seed);
  await page.goto("/");
  const imported = structuredClone(seed["predel-v1"]); imported.ratings[fact.id] = "repeat";
  await page.getByLabel("Импорт прогресса платформы").setInputFiles({ name: "old-calculus.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify({ ...imported, questionRatings: { [question.id]: "known" } })) });
  await expect(page.getByText("Различающихся записей: 2.", { exact: false })).toBeVisible();
  await page.getByLabel("Разрешение конфликтов импорта").selectOption("import");
  await page.getByRole("button", { name: "Объединить прогресс" }).click();
  expect(await page.evaluate(id => JSON.parse(localStorage.getItem("predel-v1")!).ratings[id], fact.id)).toBe("repeat");
  expect(await page.evaluate(id => JSON.parse(localStorage.getItem("predel-v1-questions")!)[id], question.id)).toBe("known");
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("discrete-study-v1")!))).toEqual(seed["discrete-study-v1"]);
  const downloadPromise = page.waitForEvent("download"); await page.getByRole("button", { name: "Экспорт обоих курсов" }).click();
  const download = await downloadPromise; const stream = await download.createReadStream(); const chunks = []; for await (const chunk of stream!) chunks.push(chunk);
  const exported = JSON.parse(Buffer.concat(chunks).toString());
  expect(exported.format).toBe("colloquium-platform-backup");
  expect(Object.keys(exported.data)).toHaveLength(6);
  expect(JSON.stringify(exported)).not.toContain("access_token");
  expect(exported.data["predel-v1"].history).toHaveLength(1);
  expect(await page.evaluate(() => localStorage.getItem("colloquium-before-import-v1"))).toBeTruthy();
});
test("malformed backup cannot overwrite progress; mobile course switching and bookmarks fit", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");
  await page.getByLabel("Импорт прогресса платформы").setInputFiles({ name: "broken.json", mimeType: "application/json", buffer: Buffer.from('{"schemaVersion":1}') });
  await expect(page.getByRole("status")).toBeVisible();
  await expect(page.getByRole("button", { name: "Объединить прогресс" })).toHaveCount(0);
  await page.getByLabel("Выбрать курс").selectOption("calculus");
  await expect(page.locator(".platform-bar")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  await page.getByLabel("Выбрать курс").selectOption("discrete");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
});
