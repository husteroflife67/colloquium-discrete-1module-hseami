import { test, expect } from "@playwright/test";

test("new navigation and course views fit phones and tablets without horizontal scrolling", async ({ page }) => {
  for (const width of [320, 375, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Продолжить подготовку" })).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const picker = page.getByLabel("Выбрать курс");
    const box = await picker.boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(width);
    for (const course of ["discrete", "calculus"]) {
      await picker.selectOption(course);
      await expect(page.locator(".sidebar")).toBeAttached();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
  }
});

test("reduced motion stops decorative and interface animations, and the font is served locally", async ({ page }) => {
  const fonts: string[] = [];
  page.on("request", request => { if (request.resourceType() === "font") fonts.push(request.url()); });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.locator(".art-float").first()).toBeVisible();
  expect(await page.locator(".art-float").first().evaluate(el => getComputedStyle(el).animationName)).toBe("none");
  expect(await page.locator(".platform-card").first().evaluate(el => getComputedStyle(el).animationName)).toBe("none");
  await page.evaluate(() => document.fonts.ready);
  expect(fonts.some(url => url.includes("onest-cyrillic"))).toBe(true);
  expect(fonts.every(url => new URL(url).hostname === "127.0.0.1")).toBe(true);
  await page.getByLabel("Выбрать курс").selectOption("calculus");
  await expect(page.locator(".sidebar")).toBeVisible();
  expect(await page.locator(".main-shell > main").evaluate(el => getComputedStyle(el).animationName)).toBe("none");
});
