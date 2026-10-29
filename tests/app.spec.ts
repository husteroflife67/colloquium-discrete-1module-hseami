import { test, expect } from "@playwright/test";
import course from "../src/data/course.json" with { type: "json" };
import { sample } from "../src/model";
test("материалы, поиск, ответы и сохранение прогресса", async ({ page }) => {
  await page.goto("/#/discrete/course");
  await expect(
    page.getByRole("heading", { name: "Большие знания. Маленькие шаги." }),
  ).toBeVisible();
  await expect(page.locator(".question-row")).toHaveCount(46);
  await page.getByLabel("Поиск по вопросам").fill("Контрапозиция");
  await expect(page.locator(".question-row")).toHaveCount(1);
  await page.getByLabel("Открыть вопрос 4", { exact: true }).click();
  await expect(page.locator(".answer")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Показать ответ", exact: true })
    .click();
  await expect(page.locator(".answer .katex").first()).toBeVisible();
  await page
    .getByRole("button", { name: "Нужно повторить", exact: true })
    .click();
  await page.reload();
  await page.locator("nav").getByRole("button", { name: "Повторение" }).click();
  await expect(page.locator(".question-row")).toHaveCount(1);
  await page
    .getByLabel("Статус вопроса 4", { exact: true })
    .selectOption("known");
  await expect(page.locator(".question-row")).toHaveCount(0);
  await page.reload();
  await page
    .locator("nav")
    .getByRole("button", { name: "Мой прогресс" })
    .click();
  await expect(
    page.getByRole("heading", { name: "1 из 46 вопросов — «Знаю»" }),
  ).toBeVisible();
});
test("билет: ограничения, уникальность, скрытые ответы, самооценка и история", async ({
  page,
}) => {
  await page.goto("/#/discrete/course");
  await page
    .locator("nav")
    .getByRole("button", { name: "Пробный билет" })
    .click();
  for (const cb of await page.locator(".check-topics input").all())
    await cb.uncheck();
  await page.getByRole("button", { name: "Сгенерировать билет" }).click();
  await expect(page.getByRole("alert")).toContainText("только 0 вопросов");
  await page.getByLabel("Математическая индукция").check();
  await page.getByRole("button", { name: "Сгенерировать билет" }).click();
  await expect(page.getByRole("alert")).toContainText("только 3 вопросов");
  await page.getByLabel("Количество вопросов").fill("3");
  await page.getByRole("button", { name: "Сгенерировать билет" }).click();
  await expect(page.locator(".ticket-question")).toHaveCount(3);
  const labels = await page
    .locator(".ticket-question>.eyebrow")
    .allTextContents();
  expect(new Set(labels.map((s) => s.split("ПРОГРАММЫ ")[1])).size).toBe(3);
  await expect(page.locator(".answer")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Завершить и открыть ответы" })
    .click();
  await expect(page.locator(".answer")).toHaveCount(3);
  await expect(
    page.getByRole("button", { name: "Сохранить результат" }),
  ).toBeDisabled();
  const articles = page.locator(".ticket-question");
  await articles
    .nth(0)
    .getByRole("button", { name: "Не помню", exact: true })
    .click();
  await articles
    .nth(1)
    .getByRole("button", { name: "Нужно повторить", exact: true })
    .click();
  await articles
    .nth(2)
    .getByRole("button", { name: "Знаю", exact: true })
    .click();
  await page.getByRole("button", { name: "Сохранить результат" }).click();
  await expect(page.getByRole("status")).toContainText("Результат сохранён");
  await page.reload();
  await page
    .locator("nav")
    .getByRole("button", { name: "Мой прогресс" })
    .click();
  await expect(page.locator(".history-row")).toHaveCount(1);
  await page.locator(".history-row").click();
  await expect(page.locator(".saved-rating")).toHaveCount(3);
  await page.locator("nav").getByRole("button", { name: "Повторение" }).click();
  await expect(page.locator(".question-row")).toHaveCount(2);
});
test("генерация и целостность контента", () => {
  expect(course.questions).toHaveLength(46);
  expect(course.questions.map((q) => q.number)).toEqual(
    Array.from({ length: 46 }, (_, i) => i + 1),
  );
  for (const q of course.questions) {
    expect(course.topics.some((t) => t.id === q.topicId)).toBeTruthy();
    for (const key of ["short", "explanation", "example", "proof"] as const)
      expect(q[key].length).toBeGreaterThan(10);
  }
  for (let i = 0; i < 100; i++) {
    const t = sample(course.questions, 6);
    expect(new Set(t.map((q) => q.id)).size).toBe(6);
  }
  expect(() => sample(course.questions, 47)).toThrow("только 46");
  expect(() => sample(course.questions, 0)).toThrow("целое");
  expect(() => sample(course.questions, 1.5)).toThrow("целое");
});
test("мобильный интерфейс и первоисточники", async ({ page, request }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/#/discrete/course");
  await expect(
    page.getByRole("heading", { name: "Большие знания. Маленькие шаги." }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page.getByRole("button", { name: "Открыть меню" }).click();
  await page
    .locator("nav")
    .getByRole("button", { name: "Пробный билет" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Пробный билет", exact: true }),
  ).toBeVisible();
  for (const source of course.sources) {
    const response = await request.get(source.url);
    expect(response.ok()).toBeTruthy();
    expect(response.headers()["content-type"]).toContain("pdf");
  }
  await page.screenshot({ path: "/tmp/discrete-mobile.png", fullPage: true });
});
test("недоступное и повреждённое хранилище", async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem("discrete-study-v1", "{broken"),
  );
  await page.goto("/#/discrete/course");
  await expect(page.getByRole("alert")).toContainText("Не удалось прочитать");
  await page
    .getByLabel("Статус вопроса 1", { exact: true })
    .selectOption("known");
  await expect(page.getByRole("alert")).toHaveCount(0);
  await page.evaluate(() => {
    Storage.prototype.setItem = () => {
      throw new Error("blocked");
    };
  });
  await page
    .getByLabel("Статус вопроса 2", { exact: true })
    .selectOption("learning");
  await expect(page.getByRole("alert")).toContainText("только до перезагрузки");
});
test("настольный интерфейс", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1080 });
  await page.goto("/#/discrete/course");
  await page.screenshot({ path: "/tmp/discrete-desktop.png", fullPage: true });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
});
test("каждый ответ открывается без ошибок, длинные формулы помещаются на телефоне", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/#/discrete/course");
  await page.getByLabel("Открыть вопрос 1", { exact: true }).click();
  for (let n = 1; n <= 46; n++) {
    await page
      .getByRole("button", { name: "Показать ответ", exact: true })
      .click();
    await expect(page.locator(".answer")).toBeVisible();
    await expect(page.locator(".katex-error")).toHaveCount(0);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      `overflow: ${n}`,
    ).toBeTruthy();
    if (n < 46)
      await page.getByRole("button", { name: "Следующий вопрос" }).click();
  }
  expect(errors).toEqual([]);
});
