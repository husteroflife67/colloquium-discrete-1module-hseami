import { test, expect } from "@playwright/test";
import { items } from "../src/calculus/content";
import { emptyData, generateTicket } from "../src/calculus/engine";
import { materialKey, materials } from "../src/platform/catalog";
const fact = items.find(i => i.definitionNumber === 1)!;
const factMaterial = materials.find(m => m.course === "calculus" && m.id === fact.id)!;
function seed() {
  const data = emptyData(); data.drafts[fact.id] = "PRIVATE DRAFT DO NOT SHARE";
  data.history = [{ id: "calc-difficulty", date: "2026-10-29T09:00:00Z", ticket: generateTicket(items, 6, "uniform", {}, []), scores: [0, 0, 0, 0, 0, 0, 0], base: 0, extra: 0, duration: 50, hints: 0, weak: [fact.id] }];
  return {
    "predel-v1": data,
    "discrete-study-v1": { version: 1, progress: {}, results: [{ id: "theory-difficulty", date: "2026-10-29T07:00:00Z", questionIds: ["1"], ratings: { "1": "repeat" } }] },
    "discrete-practice-v1": { version: 1, progress: {}, results: [{ id: "practice-difficulty", date: "2026-10-29T08:00:00Z", itemIds: ["K3-1"], ratings: { "K3-1": "repeat" } }] },
    "colloquium-platform-v1": { version: 1, bookmarks: [materialKey(factMaterial)] },
  };
}
test("global shortcut searches both courses, applies filters, and opens an exact clarification", async ({ page }) => {
  await page.goto("/"); await expect(page.getByRole("heading", { name: "Продолжить подготовку" })).toBeVisible(); await page.keyboard.press("Control+k");
  const input = page.getByLabel("Поиск по всем материалам"); await expect(input).toBeFocused();
  await input.fill("Коши"); await expect(page.locator(".study-result").first()).toBeVisible();
  await page.getByLabel("Курс поиска").selectOption("calculus"); await page.getByLabel("Вид материала поиска").selectOption("oral");
  const link = page.locator(".study-result > a").first(); const href = await link.getAttribute("href"); const questionId = new URLSearchParams(href!.split("?")[1]).get("question")!;
  await link.click(); await expect(page.locator(`[id="oral-question-${questionId}"]`)).toBeVisible();
  await expect(page.locator(".reading")).toBeVisible();
  await page.keyboard.press("Control+k"); await page.getByLabel("Поиск по всем материалам").fill("индукция");
  await page.getByLabel("Курс поиска").selectOption("discrete");
  await page.getByLabel("Вид материала поиска").selectOption("theory");
  await expect(page.locator(".study-result").first()).toBeVisible();
  await page.locator(".study-result > a").first().click();
  await expect(page.getByRole("button", { name: "Показать ответ", exact: true })).toBeVisible();
});
test("sharing uses an exact-card URL with a manual-copy fallback; feedback prepares a draft without exposing progress", async ({ page }) => {
  await page.addInitScript(data => {
    localStorage.setItem("predel-v1", JSON.stringify(data));
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: () => Promise.reject(Error("denied")) } });
  }, seed()["predel-v1"]);
  await page.goto(`/#/calculus/definition?item=${fact.id}`);
  const tools = page.locator(".reading > .platform-bookmark");
  await tools.getByRole("button", { name: "Поделиться карточкой", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByLabel("Ссылка на карточку")).toHaveValue(new RegExp(`item=${fact.id}`));
  await dialog.getByRole("button", { name: "Скопировать ссылку" }).click();
  await expect(dialog.getByRole("status")).toContainText("скопируйте вручную");
  await page.keyboard.press("Escape"); await expect(dialog).toHaveCount(0);
  await expect(tools.getByRole("button", { name: "Поделиться карточкой", exact: true })).toBeFocused();
  await tools.getByRole("button", { name: "Сообщить о неточности", exact: true }).click();
  await dialog.getByLabel("Описание неточности").fill("Нужно уточнить условие a < b");
  const issue = new URL((await dialog.getByRole("link", { name: "Открыть черновик в GitHub" }).getAttribute("href"))!);
  expect(issue.searchParams.get("body")).toContain(`ID: ${fact.id}`);
  expect(issue.searchParams.get("body")).toContain("Нужно уточнить условие a < b");
  expect(issue.searchParams.get("body")).not.toContain("PRIVATE DRAFT");
  expect(page.context().pages()).toHaveLength(1);
});
test("recovery rates only after reveal, resumes, retains original histories, and exports new results", async ({ page }) => {
  const data = seed();
  await page.addInitScript(data => { if (!sessionStorage.getItem("seeded")) { for (const [key, value] of Object.entries(data)) localStorage.setItem(key, JSON.stringify(value)); sessionStorage.setItem("seeded", "yes"); } }, data);
  await page.goto("/#/recovery"); await page.getByRole("button", { name: "Начать тренировку" }).click();
  await expect(page.getByRole("button", { name: "Разобрался", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Нужна подсказка" }).click();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("predel-v1")!).ratings)).toEqual({});
  await page.getByRole("button", { name: "Сверить с разбором" }).click();
  await page.getByRole("button", { name: "Разобрался", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Новая оценка сохранена" })).toBeVisible();
  await page.reload(); await expect(page.getByRole("heading", { name: "Новая оценка сохранена" })).toBeVisible();
  await page.getByRole("button", { name: "Дальше", exact: true }).click();
  await page.getByRole("button", { name: "Сверить с разбором" }).click();
  await page.getByRole("button", { name: "Нужно ещё повторить", exact: true }).click();
  await page.getByRole("button", { name: "Завершить сеанс" }).click();
  await expect(page.getByRole("heading", { name: "Сеанс завершён" })).toBeVisible();
  const saved = await page.evaluate(() => ({ calc: JSON.parse(localStorage.getItem("predel-v1")!), theory: JSON.parse(localStorage.getItem("discrete-study-v1")!), practice: JSON.parse(localStorage.getItem("discrete-practice-v1")!), platform: JSON.parse(localStorage.getItem("colloquium-platform-v1")!) }));
  expect(saved.calc.history).toEqual(data["predel-v1"].history);
  expect(saved.theory.results).toEqual(data["discrete-study-v1"].results);
  expect(saved.practice.results).toEqual(data["discrete-practice-v1"].results);
  expect(saved.calc.ratings[fact.id]).toBe("known"); expect(saved.calc.schedules[fact.id].intervalDays).toBe(1);
  expect(saved.platform.sessions[0].entries).toHaveLength(2);
  expect(saved.practice.progress["K3-1"]).toBe("repeat");
  await page.goto("/#/mistakes"); await expect(page.getByText("Разобрано в тренировке", { exact: true })).toHaveCount(1);
  await expect(page.getByText("2 материалов для тренировки")).toBeVisible();
  await page.goto("/"); const downloadPromise = page.waitForEvent("download"); await page.getByRole("button", { name: "Экспорт обоих курсов" }).click();
  const stream = await (await downloadPromise).createReadStream(); const chunks = []; for await (const chunk of stream!) chunks.push(chunk); const backup = JSON.parse(Buffer.concat(chunks).toString());
  expect(backup.data["colloquium-platform-v1"].sessions[0].entries).toHaveLength(2);
  await page.evaluate(() => localStorage.setItem("colloquium-platform-v1", JSON.stringify({ version: 1, bookmarks: [] })));
  await page.reload();
  for (let n = 0; n < 2; n++) {
    await page.getByLabel("Импорт прогресса платформы").setInputFiles({ name: "new-platform.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(backup)) });
    await page.getByRole("button", { name: "Объединить прогресс" }).click();
  }
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("colloquium-platform-v1")!).sessions.length)).toBe(1);
  // Legacy bookmark-only data must not erase newly saved recovery sessions.
  await page.getByLabel("Импорт прогресса платформы").setInputFiles({ name: "old-platform.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify({ format: "colloquium-platform-backup", version: 1, data: { "colloquium-platform-v1": { version: 1, bookmarks: [] } } })) });
  await page.getByRole("button", { name: "Объединить прогресс" }).click();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("colloquium-platform-v1")!).sessions[0].entries.length)).toBe(2);
});
test("a failed progress write cannot advance recovery or overwrite historical data", async ({ page }) => {
  const data = seed();
  await page.addInitScript(data => { for (const [key, value] of Object.entries(data)) localStorage.setItem(key, JSON.stringify(value)); const original = Storage.prototype.setItem; Storage.prototype.setItem = function(key, value) { if (key === "predel-v1") throw new DOMException("quota", "QuotaExceededError"); return original.call(this, key, value); }; }, data);
  await page.goto("/#/recovery"); await page.getByRole("button", { name: "Начать тренировку" }).click(); await page.getByRole("button", { name: "Сверить с разбором" }).click(); await page.getByRole("button", { name: "Разобрался", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Не удалось сохранить оценку");
  await expect(page.getByRole("button", { name: "Дальше", exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("colloquium-platform-v1")!))).toEqual(data["colloquium-platform-v1"]);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("predel-v1")!))).toEqual(data["predel-v1"]);
});
test("new search, review and dialog layouts fit a 320px phone with reduced motion", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 812 }); await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(data => { for (const [key, value] of Object.entries(data)) localStorage.setItem(key, JSON.stringify(value)); }, seed());
  for (const route of ["/#/search?q=Коши", "/#/recovery", "/#/calculus/definition?item=" + fact.id]) {
    await page.goto(route); await expect(page.locator(".platform-bar")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.locator(".reading > .platform-bookmark").getByRole("button", { name: "Сообщить о неточности", exact: true }).click();
  const dialog = page.getByRole("dialog"); await expect(dialog).toBeVisible();
  expect(await dialog.evaluate(el => getComputedStyle(el).animationName)).toBe("none");
  const box = await dialog.boundingBox(); expect(box!.x).toBeGreaterThanOrEqual(0); expect(box!.x + box!.width).toBeLessThanOrEqual(320);
});

test("course-filtered recovery updates theory mastery without changing the original ticket", async ({ page }) => {
  const data = seed(); await page.addInitScript(data => { for (const [key, value] of Object.entries(data)) localStorage.setItem(key, JSON.stringify(value)); }, data);
  await page.goto("/#/mistakes"); await page.getByLabel("Фильтр курса").selectOption("discrete"); await page.getByRole("link", { name: "Разобрать сложное", exact: true }).click();
  await expect(page.getByLabel("Курс тренировки")).toHaveValue("discrete");
  await page.getByRole("button", { name: "Начать тренировку" }).click();
  for (let n = 0; n < 2; n++) { await page.getByRole("button", { name: "Сверить с разбором" }).click(); await page.getByRole("button", { name: "Разобрался", exact: true }).click(); await page.getByRole("button", { name: "Дальше", exact: true }).click(); }
  await expect(page.getByRole("heading", { name: "Сеанс завершён" })).toBeVisible();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("discrete-study-v1")!));
  expect(saved.progress["1"]).toEqual({ status: "known", review: false });
  expect(saved.results).toEqual(data["discrete-study-v1"].results);
});
