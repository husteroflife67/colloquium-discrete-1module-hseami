import { test, expect } from "@playwright/test";
test("card, draft, independent question rating and reload persistence", async ({
  page,
}) => {
  await page.goto("/#/calculus/dashboard");
  await page
    .getByRole("button", { name: "Определения", exact: true })
    .first()
    .click();
  await page.locator(".library-card").first().click();
  await page
    .getByRole("button", { name: "Открыть карточку", exact: true })
    .click();
  await page
    .getByPlaceholder("Попробуйте воспроизвести ответ без подсказок…")
    .fill("Мой сохранённый ответ");
  await page
    .locator(".reading > .ratings")
    .getByRole("button", { name: "Знаю", exact: true })
    .click();
  await page.reload();
  await page
    .getByRole("button", { name: "Определения", exact: true })
    .first()
    .click();
  await expect(page.locator(".tiny-status").first()).toHaveText("Знаю");
  await page.locator(".library-card").first().click();
  await page
    .getByRole("button", { name: "Открыть карточку", exact: true })
    .click();
  await expect(page.locator("textarea")).toHaveValue("Мой сохранённый ответ");
});
test("full ticket stages, extra threshold and irreversible choice, history replay", async ({
  page,
}) => {
  await page.goto("/#/calculus/dashboard");
  await page
    .getByRole("button", { name: "Пробный коллоквиум", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Начать тренировку", exact: true })
    .click();
  await expect(page.locator(".sim-item")).toHaveCount(2);
  await page.reload();
  await page
    .getByRole("button", { name: "Пробный коллоквиум", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Подготовка", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Вызов на определения", exact: true })
    .click();
  await expect(page.locator(".sim-item")).toHaveCount(4);
  for (const prompt of await page.locator(".sim-item p").all())
    await expect(prompt).toHaveText(
      /^(Сформулируйте|Приведите|Перечислите|Определите|Что|Как|При|Дайте)/,
    );
  await page
    .getByRole("button", { name: "Определения сданы", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Ко второму принимающему", exact: true })
    .click();
  await expect(page.locator(".sim-item")).toHaveCount(1);
  await page
    .getByRole("button", { name: "Короткое утверждение сдано", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Завершить базовый ответ", exact: true })
    .click();
  const scores = page.locator(".score-grid select");
  for (let i = 0; i < 7; i++)
    await scores.nth(i).selectOption(String([0.5, 0.5, 0.5, 0.5, 1, 1, 2][i]));
  await expect(
    page.getByRole("button", { name: "Взять допзадачу на 2", exact: true }),
  ).toHaveCount(0);
  await scores.nth(5).selectOption("1.5");
  await expect(
    page.getByRole("button", { name: "Взять допзадачу на 2", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Взять допзадачу на 2", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Перейти к сдаче", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Завершить сдачу", exact: true })
    .click();
  await expect(scores.first()).toBeDisabled();
  await page
    .getByRole("button", { name: "Сохранить результат", exact: true })
    .click();
  await page.getByRole("button", { name: "История", exact: true }).click();
  await expect(page.locator(".history-card")).toHaveCount(1);
  await expect(page.locator(".history-card")).toContainText("6.5 / 8");
  await page
    .getByRole("button", { name: "Повторить состав", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Начать тренировку", exact: true })
    .click();
  await expect(page.locator(".sim-item")).toHaveCount(2);
});
test("export import validation and reset cancellation", async ({ page }) => {
  await page.goto("/#/calculus/dashboard");
  await page.getByRole("button", { name: "Настройки", exact: true }).click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Экспорт JSON", exact: true }).click();
  const download = await downloadPromise;
  const path = await download.path();
  await page.getByLabel("Импорт JSON", { exact: true }).setInputFiles(path!);
  await expect(page.getByRole("status")).toContainText("Данные проверены");
  await page.getByLabel("Импорт JSON", { exact: true }).setInputFiles({
    name: "bad.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"schemaVersion":99}'),
  });
  await expect(page.getByRole("status")).toContainText("не соответствует");
  page.once("dialog", (d) => d.dismiss());
  await page
    .getByRole("button", { name: "Сбросить прогресс", exact: true })
    .click();
  await expect(page.getByRole("status")).not.toContainText("сброшен");
});
test("exam automatic call, shared30 minute limit and second40 minute limit", async ({
  page,
}) => {
  await page.clock.install();
  await page.goto("/#/calculus/dashboard");
  await page
    .getByRole("button", { name: "Пробный коллоквиум", exact: true })
    .click();
  await page.getByLabel("Режим", { exact: true }).selectOption("exam");
  await page
    .getByRole("button", { name: "Начать тренировку", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Пауза", exact: true }),
  ).toHaveCount(0);
  await page.clock.fastForward(1500_000);
  await expect(
    page.getByRole("heading", { name: "Устные определения", exact: true }),
  ).toBeVisible();
  await page.clock.fastForward(300_000);
  await page.clock.runFor(1000);
  await expect(
    page.getByRole("heading", { name: "Второй принимающий", exact: true }),
  ).toBeVisible();
  await page.clock.fastForward(2400_000);
  await expect(
    page.getByRole("heading", { name: "Самооценка", exact: true }),
  ).toBeVisible();
});
test("mobile reading and dark theme fit viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/#/calculus/dashboard");
  await page.getByRole("button", { name: "Меню", exact: true }).click();
  await page.getByRole("button", { name: "Тёмная тема", exact: true }).click();
  await page
    .getByRole("button", { name: "Теория и доказательства", exact: true })
    .click();
  await page.locator(".library-card").first().click();
  await page
    .getByRole("button", { name: "Полностью", exact: true })
    .first()
    .click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await expect(page.locator(".katex-error")).toHaveCount(0);
});
test("new oral question exposes hint answer criteria mistake and persists separate rating", async ({
  page,
}) => {
  await page.goto("/#/calculus/dashboard");
  await page
    .getByRole("button", { name: "Вопросы принимающего", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Поиск вопроса", exact: true })
    .fill("отрицание условия Коши");
  const card = page.locator(".question");
  await expect(card).toHaveCount(1);
  await card.getByRole("button", { name: "Подсказка", exact: true }).click();
  await expect(card.locator(".hint")).toContainText("фиксированная точность");
  await card
    .getByRole("button", { name: "Открыть ответ", exact: true })
    .click();
  await expect(card).toContainText("существует ε₀>0");
  await expect(card).toContainText("Достаточно сказать:");
  await expect(card).toContainText("Типичная ошибка:");
  await card.getByRole("button", { name: "Знаю", exact: true }).click();
  await page.reload();
  await page
    .getByRole("button", { name: "Вопросы принимающего", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Поиск вопроса", exact: true })
    .fill("отрицание условия Коши");
  await card
    .getByRole("button", { name: "Открыть ответ", exact: true })
    .click();
  await expect(
    card.getByRole("button", { name: "Знаю", exact: true }),
  ).toHaveClass("active");
  await page.getByRole("button", { name: "Обзор", exact: true }).click();
  await expect(page.locator(".learning-summary")).toContainText("1 / 290");
});
test("supplementary source and alternative proofs keep the original progress objects", async ({
  page,
  request,
}) => {
  await page.goto("/#/calculus/dashboard");
  await page
    .getByRole("button", { name: "Теория и доказательства", exact: true })
    .click();
  await page
    .locator(".library-card")
    .filter({ hasText: "Больцано–Вейерштрасс и критерий частичных пределов" })
    .click();
  await expect(page.locator(".provenance a").first()).toHaveAttribute(
    "href",
    "/sources/corrected-guide.pdf#page=13",
  );
  const alternative = page.locator("details.supplement");
  await alternative.locator("summary").click();
  await alternative
    .getByRole("button", { name: "Полностью", exact: true })
    .click();
  await expect(alternative.locator(".proof-steps li")).toHaveCount(5);
  await expect(alternative).toContainText(
    "Разные индексы не требуют разных значений",
  );
  await expect(page.locator(".reading > .ratings button.active")).toHaveCount(
    0,
  );
  const htmlIds = await page
    .locator("[id]")
    .evaluateAll((nodes) => nodes.map((n) => n.id));
  expect(new Set(htmlIds).size).toBe(htmlIds.length);
  await page.getByRole("button", { name: "К списку", exact: false }).click();
  await page
    .locator(".library-card")
    .filter({ hasText: "Критерий Коши для предела функции" })
    .click();
  await page.locator("details.supplement summary").click();
  await page
    .locator("details.supplement")
    .getByRole("button", { name: "Полностью", exact: true })
    .click();
  await expect(page.locator("details.supplement .proof-steps li")).toHaveCount(
    6,
  );
  await expect(page.locator(".katex-error")).toHaveCount(0);
  const pdf = await request.get("/sources/corrected-guide.pdf");
  expect(pdf.ok()).toBe(true);
  expect((await pdf.body()).subarray(0, 5).toString()).toBe("%PDF-");
});
test("all43 official cards are numbered and auxiliary progress is retained", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      "predel-v1",
      JSON.stringify({
        schemaVersion: 1,
        ratings: { "def-nested": "known" },
        checklists: {},
        drafts: {},
        history: [],
        theme: "light",
      }),
    ),
  );
  await page.goto("/#/calculus/dashboard");
  await page
    .getByRole("button", { name: "Определения", exact: true })
    .first()
    .click();
  await expect(page.locator(".library-card")).toHaveCount(43);
  await page
    .getByLabel("Поиск материалов", { exact: true })
    .fill("Внутренняя точка");
  await page.locator(".library-card").click();
  await expect(page.locator(".reading h2")).toContainText("32.");
  await page
    .getByRole("button", { name: "Открыть карточку", exact: true })
    .click();
  await expect(page.locator(".provenance a").first()).toHaveAttribute(
    "href",
    "/sources/definitions.pdf#page=1",
  );
  await page.getByRole("button", { name: "К списку", exact: false }).click();
  await page.getByLabel("Поиск материалов", { exact: true }).fill("");
  await page
    .getByLabel("Состав карточек", { exact: true })
    .selectOption("support");
  await expect(page.locator(".library-card")).toHaveCount(6);
  await expect(
    page.locator(".library-card").filter({ hasText: "Вложенные отрезки" }),
  ).toContainText("Знаю");
});
test("spaced review schedules actual recall and survives export and reload", async ({
  page,
}) => {
  await page.goto("/#/calculus/dashboard");
  await page.getByRole("button", { name: "На сегодня", exact: true }).click();
  const card = page.getByRole("region", { name: "Карточка повторения" });
  await expect(card.getByRole("button", { name: /^Знаю/ })).toHaveCount(0);
  await card
    .getByRole("button", { name: "Вспомнил — открыть ответ", exact: true })
    .click();
  await card.getByRole("button", { name: /^Знаю/ }).click();
  await expect(page.getByRole("status")).toContainText("Следующее повторение");
  await page.reload();
  await page.getByRole("button", { name: "На сегодня", exact: true }).click();
  await expect(card).toContainText("Грани, максимум и минимум");
  await page
    .getByRole("button", {
      name: "Показать ближайшие повторения (1)",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("button", { name: "Аксиома непрерывности", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Настройки", exact: true }).click();
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "Экспорт JSON", exact: true }).click();
  const download = await pending;
  await page
    .getByLabel("Импорт JSON", { exact: true })
    .setInputFiles((await download.path())!);
  await expect(page.getByRole("status")).toContainText("Данные проверены");
});
test("oral examiner guides six questions and records only explicit self-ratings", async ({
  page,
}) => {
  await page.goto("/#/calculus/dashboard");
  await page
    .getByRole("button", { name: "Устный экзаменатор", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Начать беседу", exact: true })
    .click();
  await page.locator(".oral-examiner textarea").fill("Мой устный ответ");
  await page
    .getByRole("button", {
      name: "Я закончил основной ответ → к уточнениям",
      exact: true,
    })
    .click();
  for (let i = 0; i < 6; i++) {
    await page
      .getByRole("button", { name: "Открыть строгий ответ", exact: true })
      .click();
    await page
      .getByRole("group", { name: "Самооценка текущего ответа", exact: true })
      .getByRole("button", {
        name: i === 0 ? "Знаю" : i === 1 ? "Частично" : "Повторить",
        exact: true,
      })
      .click();
    await page
      .getByRole("button", {
        name: i === 5 ? "Итоги беседы" : "Следующий вопрос",
        exact: true,
      })
      .click();
  }
  await expect(
    page.getByRole("heading", { name: "Итоги этой беседы", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".oral-examiner")).toContainText(
    "Оценено уточнений: 6 из 6",
  );
  await expect(page.locator(".oral-examiner")).toContainText("Знаю: 1");
  await expect(page.locator(".oral-examiner")).toContainText("Повторить: 4");
  await page.reload();
  await page
    .getByRole("button", { name: "Устный экзаменатор", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Начать беседу", exact: true })
    .click();
  await expect(page.locator(".oral-examiner textarea")).toHaveValue(
    "Мой устный ответ",
  );
});
test("long official formulas and new modes fit mobile viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/#/calculus/dashboard");
  await page.getByRole("button", { name: "Меню", exact: true }).click();
  await page
    .getByRole("button", { name: "Определения", exact: true })
    .first()
    .click();
  await page
    .getByLabel("Поиск материалов", { exact: true })
    .fill("Пределы в бесконечности");
  await page.locator(".library-card").click();
  await page
    .getByRole("button", { name: "Открыть карточку", exact: true })
    .click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await expect(page.locator(".katex-error")).toHaveCount(0);
  await page.getByRole("button", { name: "Меню", exact: true }).click();
  await page
    .getByRole("button", { name: "Устный экзаменатор", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Начать беседу", exact: true })
    .click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Меню", exact: true }).click();
  await page.getByRole("button", { name: "На сегодня", exact: true }).click();
  await page
    .getByRole("button", { name: "Вспомнил — открыть ответ", exact: true })
    .click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
