import { test, expect } from "@playwright/test";
test("production platform loads both course routes, math, PDFs and source images under the repository prefix", async ({ page, request, baseURL }) => {
  await page.goto(baseURL!);
  await expect(page.getByRole("heading", { name: "Продолжить подготовку" })).toBeVisible();
  await page.getByLabel("Выбрать курс").selectOption("calculus");
  await page.locator(".sidebar").getByText("Определения", { exact: true }).click();
  await page.locator(".library-card").first().click();
  await page.getByRole("button", { name: "Открыть карточку", exact: true }).click();
  await expect(page.locator(".reading .katex").first()).toBeVisible();
  await page.getByLabel("Выбрать курс").selectOption("discrete");
  await expect(page.locator(".sidebar")).toContainText("Доказательства");
  for (const path of ["sources/program.pdf", "sources/notes.pdf", "sources/corrected-guide.pdf", "sources/definitions.pdf", "materials/DMlec-base.pdf"]) {
    const response = await request.get(new URL(path, baseURL).href);
    expect(response.ok()).toBe(true);
    expect((await response.body()).subarray(0, 5).toString()).toBe("%PDF-");
  }
});

test("production search and feedback keep the deployment prefix and review route loads", async ({ page, baseURL }) => {
  await page.goto(`${baseURL}#/search?q=${encodeURIComponent("индукция")}&course=discrete&kind=theory`);
  await expect(page.locator(".study-result").first()).toBeVisible();
  await page.locator(".study-result > a").first().click();
  await page.getByRole("button", { name: "Поделиться карточкой", exact: true }).click();
  await expect(page.getByLabel("Ссылка на карточку")).toHaveValue(new RegExp(`${baseURL!.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}#/discrete/course\\?item=`));
  await page.keyboard.press("Escape");
  await page.getByRole("link", { name: "Журнал", exact: true }).click();
  await page.getByRole("link", { name: "Разобрать сложное", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Разобрать сложное." })).toBeVisible();
});
