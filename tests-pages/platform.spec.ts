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
