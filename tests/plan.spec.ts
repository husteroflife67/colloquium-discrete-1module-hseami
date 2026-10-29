import { test, expect } from "@playwright/test";
import course from "../src/data/course.json" with { type: "json" };
import { practice, isOptionalClass } from "../src/practice-model";
import {
  preparationPlan,
  planProgress,
  firstUnfinished,
  planStorageKey,
} from "../src/plan-model";
async function openPlan(page: any) {
  await page.goto("/#/discrete/course");
  await page
    .locator("nav")
    .getByRole("button", { name: "План подготовки", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "План подготовки", exact: true }),
  ).toBeVisible();
}
test("содержание маршрута: зависимости, реальные номера и отсутствие исключённых материалов", () => {
  const stages = preparationPlan.stages;
  expect(stages).toHaveLength(12);
  expect(new Set(stages.map((s) => s.id)).size).toBe(stages.length);
  const ids = new Set<string>(),
    theoryIds = new Set<string>();
  const usedPractice = new Set<string>();
  for (const [index, stage] of stages.entries()) {
    expect(stage.items.some((i) => i.kind === "learn")).toBeTruthy();
    expect(stage.items.some((i) => i.kind === "proof")).toBeTruthy();
    expect(stage.items.some((i) => i.kind === "mastery")).toBeTruthy();
    for (const id of stage.dependsOn)
      expect(stages.findIndex((s) => s.id === id)).toBeLessThan(index);
    for (const item of stage.items) {
      expect(ids.has(item.id)).toBe(false);
      ids.add(item.id);
      expect(item.targets.length).toBeGreaterThan(0);
      for (const target of item.targets) {
        if (target.kind === "theory") {
          expect(course.questions.some((q) => q.id === target.id)).toBeTruthy();
          theoryIds.add(target.id);
        } else {
          const q = practice.items.find((q) => q.id === target.id);
          expect(q, `${item.id}: ${target.id}`).toBeDefined();
          if (!q) continue;
          expect(isOptionalClass(q), q.number).toBe(false);
          expect(q.blocked, q.number).toBe(false);
          expect(q.outOfScope, q.number).toBe(false);
          expect(q.solutionOrigin, q.number).not.toBe("missing");
          usedPractice.add(q.id);
          if (item.kind === "class") expect(q.source).toBe("class");
          if (item.kind === "homework") expect(q.source).toBe("homework");
          if (item.kind === "proof") expect(q.proofEligible).toBe(true);
        }
      }
    }
  }
  expect([...theoryIds].sort()).toEqual(
    course.questions.map((q) => q.id).sort(),
  );
  expect(usedPractice.size).toBeGreaterThan(60);
  expect(stages.find((s) => s.id === "catalan")?.notes.join(" ")).toContain(
    "незвёздочных",
  );
  const total = stages.flatMap((s) => s.items).length;
  expect(planProgress({})).toEqual({ completed: 0, total, percent: 0 });
  expect(planProgress({ ghost: true }).completed).toBe(0);
  const all = Object.fromEntries(
    stages.flatMap((s) => s.items).map((i) => [i.id, true]),
  );
  expect(planProgress(all)).toEqual({ completed: total, total, percent: 100 });
  expect(firstUnfinished(all)).toBeNull();
  all["functions-2"] = false;
  expect(firstUnfinished(all)?.item.id).toBe("functions-2");
});
test("чекбоксы, этап и общий прогресс сохраняются; Продолжить выбирает именно первый незавершённый", async ({
  page,
}) => {
  await openPlan(page);
  const first = preparationPlan.stages[0];
  const total = preparationPlan.stages.flatMap((s) => s.items).length;
  await expect(
    page.getByRole("progressbar", {
      name: "Прогресс всего плана",
      exact: true,
    }),
  ).toHaveAttribute("value", "0");
  await page.getByRole("button", { name: "Продолжить", exact: true }).click();
  await expect(page.locator("#plan-check-logic-1")).toBeFocused();
  await page.locator("#plan-check-logic-1").check();
  await page.locator("#plan-check-logic-3").check();
  await expect(
    page.getByRole("progressbar", {
      name: "Прогресс всего плана",
      exact: true,
    }),
  ).toHaveAttribute("value", "2");
  await expect(
    page.getByRole("progressbar", { name: "Прогресс этапа 1", exact: true }),
  ).toHaveAttribute("value", "2");
  await page.getByRole("button", { name: "Продолжить", exact: true }).click();
  await expect(page.locator("#plan-check-logic-2")).toBeFocused();
  await page.reload();
  await page
    .locator("nav")
    .getByRole("button", { name: "План подготовки", exact: true })
    .click();
  await expect(page.locator("#plan-check-logic-1")).toBeChecked();
  await expect(page.locator("#plan-check-logic-2")).not.toBeChecked();
  for (const item of first.items)
    await page.locator(`#plan-check-${item.id}`).check();
  await expect(
    page.getByRole("progressbar", { name: "Прогресс этапа 1", exact: true }),
  ).toHaveAttribute("value", String(first.items.length));
  await expect(
    page.getByRole("progressbar", {
      name: "Прогресс всего плана",
      exact: true,
    }),
  ).toHaveAttribute("max", String(total));
  await expect(page.locator(".plan-stage-tally")).toContainText("1 / 12");
  await page.getByRole("button", { name: "Продолжить", exact: true }).click();
  await expect(page.locator("#plan-check-sets-1")).toBeFocused();
  await expect(page.locator("#plan-stage-heading-sets")).toHaveAttribute(
    "aria-expanded",
    "true",
  );
  await page.locator("#plan-stage-heading-logic").click();
  if ((await page.locator("#plan-check-logic-2").isVisible()) === false)
    await page.locator("#plan-stage-heading-logic").click();
  await page.locator("#plan-check-logic-2").uncheck();
  await page.getByRole("button", { name: "Продолжить", exact: true }).click();
  await expect(page.locator("#plan-check-logic-2")).toBeFocused();
});
test("ссылки открывают точную теорию и задачу с возвратом к пункту; просмотр ничего не отмечает", async ({
  page,
}) => {
  await page.goto("/#/discrete/course");
  await page
    .getByLabel("Статус вопроса 1", { exact: true })
    .selectOption("known");
  await page
    .locator("nav")
    .getByRole("button", { name: "План подготовки", exact: true })
    .click();
  await page
    .locator("#plan-item-logic-1")
    .getByRole("button", { name: "Открыть пункт программы 1", exact: true })
    .click();
  await expect(page.locator(".question-heading")).toContainText(
    "Логические значения",
  );
  await expect(page.locator(".answer")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Вернуться к пункту плана" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Вернуться к пункту плана" }).click();
  await expect(page.locator("#plan-check-logic-1")).toBeFocused();
  await expect(page.locator("#plan-check-logic-1")).not.toBeChecked();
  await page
    .locator("#plan-item-logic-5")
    .getByRole("button", { name: "Открыть материал К1.1", exact: true })
    .click();
  await expect(page.getByAltText("Оригинал условия К1.1")).toBeVisible();
  await expect(page.locator(".practice-solution")).toHaveCount(0);
  await page.getByRole("button", { name: "Вернуться к пункту плана" }).click();
  await expect(page.locator("#plan-check-logic-5")).toBeFocused();
  await expect(page.locator("#plan-check-logic-5")).not.toBeChecked();
  const storage = await page.evaluate(
    (key) => ({
      plan: localStorage.getItem(key),
      theory: JSON.parse(localStorage.getItem("discrete-study-v1")!),
      practice: localStorage.getItem("discrete-practice-v1"),
    }),
    planStorageKey,
  );
  expect(storage.plan).toBeNull();
  expect(storage.theory.progress["1"].status).toBe("known");
  expect(storage.practice).toBeNull();
  await page.locator("#plan-check-logic-1").check();
  await page.reload();
  await page
    .locator("nav")
    .getByRole("button", { name: "Мой прогресс" })
    .click();
  await expect(
    page.getByRole("heading", { name: "1 из 46 вопросов — «Знаю»" }),
  ).toBeVisible();
});
test("ссылка на лекционное доказательство и зависимости ведут к нужным материалам", async ({
  page,
}) => {
  await openPlan(page);
  await page.locator("#plan-stage-heading-bijections").click();
  await page
    .locator("#plan-stage-body-bijections .plan-dependencies")
    .getByRole("button", { name: "Функции, образы и композиция", exact: true })
    .click();
  await expect(page.locator("#plan-stage-heading-functions")).toBeFocused();
  await expect(page.locator("#plan-stage-heading-functions")).toHaveAttribute(
    "aria-expanded",
    "true",
  );
  await page
    .locator("#plan-item-bijections-2")
    .getByRole("button", { name: "Открыть материал Лемма 3.4", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Лемма 3.4", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".material-source").first()).toContainText(
    "DMlec-base.pdf",
  );
  await page.getByRole("button", { name: "Вернуться к пункту плана" }).click();
  await expect(page.locator("#plan-check-bijections-2")).toBeFocused();
});
test("завершённый маршрут не предлагает фиктивный следующий пункт; снятие галочки возобновляет маршрут", async ({
  page,
}) => {
  const done = Object.fromEntries(
    preparationPlan.stages.flatMap((s) => s.items).map((i) => [i.id, true]),
  );
  await page.addInitScript(
    ({ key, done }) =>
      localStorage.setItem(key, JSON.stringify({ version: 1, done })),
    { key: planStorageKey, done },
  );
  await openPlan(page);
  await expect(
    page.getByRole("button", { name: "План выполнен", exact: true }),
  ).toBeDisabled();
  await expect(page.locator(".plan-percentage")).toHaveText("100%");
  await page.locator("#plan-check-logic-1").uncheck();
  await expect(
    page.getByRole("button", { name: "Продолжить", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Продолжить", exact: true }).click();
  await expect(page.locator("#plan-check-logic-1")).toBeFocused();
});
test("повреждённое или недоступное хранилище не ломает план", async ({
  page,
}) => {
  await page.addInitScript(
    (key) => localStorage.setItem(key, "{bad"),
    planStorageKey,
  );
  await openPlan(page);
  await expect(page.getByRole("alert")).toContainText("отметки плана");
  await page.locator("#plan-check-logic-1").check();
  await expect(page.getByRole("alert")).toHaveCount(0);
  await page.evaluate(() => {
    Storage.prototype.setItem = () => {
      throw Error("full");
    };
  });
  await page.locator("#plan-check-logic-2").check();
  await expect(page.getByRole("alert")).toContainText("только до перезагрузки");
  await expect(page.locator("#plan-check-logic-2")).toBeChecked();
});
test("маршрут удобен на телефоне и не растягивает страницу", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/#/discrete/course");
  await page.getByRole("button", { name: "Открыть меню" }).click();
  await page
    .locator("nav")
    .getByRole("button", { name: "План подготовки", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "План подготовки", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page.getByRole("button", { name: "Продолжить", exact: true }).click();
  await expect(page.locator("#plan-check-logic-1")).toBeFocused();
  await page
    .locator("#plan-item-logic-1")
    .getByRole("button", { name: "Открыть пункт программы 1", exact: true })
    .click();
  await page.getByRole("button", { name: "Вернуться к пункту плана" }).click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({
    path: "/tmp/preparation-plan-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
});
