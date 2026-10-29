import {
  test,
  expect,
  type Browser,
  type BrowserContext,
  type Page,
} from "@playwright/test";
import { readFileSync } from "node:fs";
const host = "https://testproject.supabase.co";
const u1 = "11111111-1111-4111-8111-111111111111",
  u2 = "22222222-2222-4222-8222-222222222222";
const email = (uid: string) =>
  uid === u1 ? "student@example.com" : "other@example.com";
function session(uid: string) {
  const payload = Buffer.from(
    JSON.stringify({
      sub: uid,
      role: "authenticated",
      aud: "authenticated",
      exp: Math.floor(Date.now() / 1000) + 3600,
      iss: host + "/auth/v1",
    }),
  ).toString("base64url");
  return {
    access_token: `eyJhbGciOiJIUzI1NiJ9.${payload}.fixture`,
    refresh_token: `refresh-${uid}`,
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    token_type: "bearer",
    user: {
      id: uid,
      email: email(uid),
      aud: "authenticated",
      role: "authenticated",
      app_metadata: { provider: "email" },
      user_metadata: {},
      created_at: "2026-10-25T12:00:00Z",
    },
  };
}
class Cloud {
  users = new Map<string, Map<string, any>>();
  sentEmails: string[] = [];
  rows(uid: string) {
    let map = this.users.get(uid);
    if (!map) {
      map = new Map();
      this.users.set(uid, map);
    }
    return map;
  }
  async install(context: BrowserContext) {
    await context.route(host + "/**", async (route) => {
      const r = route.request(),
        url = new URL(r.url());
      const json = (status: number, body: any) =>
        route.fulfill({
          status,
          contentType: "application/json",
          body: JSON.stringify(body),
        });
      const token = r.headers().authorization?.split(" ")[1];
      let uid = u1;
      try {
        uid = JSON.parse(
          Buffer.from(token!.split(".")[1], "base64url").toString(),
        ).sub;
      } catch {}
      if (["/rest/v1/rpc/sync_study_progress", "/rest/v1/rpc/sync_calculus_progress"].includes(url.pathname)) {
        const rows = this.rows(url.pathname.endsWith("sync_calculus_progress") ? uid + "/calculus" : uid),
          accepted: string[] = [],
          conflicts: string[] = [];
        for (const change of r.postDataJSON().p_changes) {
          const current = rows.get(change.key);
          if (
            current?.mutation_id === change.mutation_id ||
            (current &&
              JSON.stringify(current.value) === JSON.stringify(change.value))
          ) {
            accepted.push(change.mutation_id);
          } else if ((current?.revision ?? 0) === change.base_revision) {
            rows.set(change.key, {
              key: change.key,
              value: change.value,
              revision: (current?.revision ?? 0) + 1,
              mutation_id: change.mutation_id,
            });
            accepted.push(change.mutation_id);
          } else conflicts.push(change.key);
        }
        await json(200, { rows: [...rows.values()], accepted, conflicts });
        return;
      }
      if (url.pathname === "/auth/v1/user") {
        await json(200, session(uid).user);
        return;
      }
      if (url.pathname === "/auth/v1/logout") {
        await json(200, {});
        return;
      }
      if (url.pathname === "/auth/v1/otp") {
        this.sentEmails.push(r.postDataJSON().email);
        await json(200, {});
        return;
      }
      if (url.pathname === "/auth/v1/token") {
        const body = r.postDataJSON();
        await json(200, session(body.email === "other@example.com" ? u2 : u1));
        return;
      }
      await json(404, { message: "Unexpected fixture request" });
    });
  }
}
async function device(
  browser: Browser,
  cloud: Cloud,
  uid = u1,
  seed: Record<string, any> = {},
) {
  const context = await browser.newContext();
  await cloud.install(context);
  await context.addInitScript(
    ({ auth, seed }) => {
      if (!sessionStorage.getItem("fixture-initialized")) {
        localStorage.setItem("sb-testproject-auth-token", JSON.stringify(auth));
        for (const [key, value] of Object.entries(seed))
          localStorage.setItem(key, JSON.stringify(value));
        sessionStorage.setItem("fixture-initialized", "1");
      }
    },
    { auth: session(uid), seed },
  );
  const page = await context.newPage();
  await page.goto("http://127.0.0.1:5175/#/discrete/course");
  await expect(page.locator(".sync-badge")).toContainText(
    "Прогресс синхронизирован",
  );
  return { context, page };
}
async function flush(page: Page) {
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(page.locator(".sync-badge")).toContainText(
    "Прогресс синхронизирован",
  );
}
async function settings(page: Page) {
  await page
    .getByRole("button", { name: "Открыть синхронизацию прогресса" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Синхронизация", exact: true }),
  ).toBeVisible();
}
async function practiceDetail(page: Page) {
  await page
    .locator("nav")
    .getByRole("button", { name: "Доказательства", exact: true })
    .click();
  await page.getByLabel("Поиск по номеру и тексту задания").fill("К1.1");
  await page.getByLabel("Разобрать К1.1", { exact: true }).click();
}
test.use({ baseURL: "http://127.0.0.1:5175" });
test("два устройства: разные поля объединяются, все три раздела обновляются без перезагрузки", async ({
  browser,
}) => {
  const cloud = new Cloud(),
    a = await device(browser, cloud),
    b = await device(browser, cloud);
  try {
    await a.page
      .getByLabel("Статус вопроса 1", { exact: true })
      .selectOption("known");
    await b.page
      .locator("nav")
      .getByRole("button", { name: "План подготовки", exact: true })
      .click();
    await b.page.locator("#plan-check-logic-1").check();
    await expect.poll(() => cloud.rows(u1).size).toBe(2);
    await flush(a.page);
    await flush(b.page);
    await a.page
      .locator("nav")
      .getByRole("button", { name: "План подготовки", exact: true })
      .click();
    await expect(a.page.locator("#plan-check-logic-1")).toBeChecked();
    await b.page
      .locator("nav")
      .getByRole("button", { name: "Темы и вопросы", exact: true })
      .click();
    await expect(
      b.page.getByLabel("Статус вопроса 1", { exact: true }),
    ).toHaveValue("known");
    await practiceDetail(a.page);
    await practiceDetail(b.page);
    await a.page
      .getByLabel("Статус изучения", { exact: true })
      .selectOption("independent");
    await expect
      .poll(() => cloud.rows(u1).get("practice/K1-1")?.value)
      .toBe("independent");
    await flush(b.page);
    await expect(
      b.page.getByLabel("Статус изучения", { exact: true }),
    ).toHaveValue("independent");
  } finally {
    await a.context.close();
    await b.context.close();
  }
});
test("офлайн-отметки переживают перезагрузку и не затирают конфликтующее изменение молча", async ({
  browser,
}) => {
  const cloud = new Cloud(),
    a = await device(browser, cloud),
    b = await device(browser, cloud);
  try {
    await a.page
      .getByLabel("Статус вопроса 1", { exact: true })
      .selectOption("learning");
    await expect.poll(() => cloud.rows(u1).get("theory/1")?.revision).toBe(1);
    await flush(b.page);
    await expect(
      b.page.getByLabel("Статус вопроса 1", { exact: true }),
    ).toHaveValue("learning");
    await a.context.setOffline(true);
    await a.page
      .getByLabel("Статус вопроса 1", { exact: true })
      .selectOption("known");
    await expect
      .poll(() =>
        a.page.evaluate(
          () =>
            JSON.parse(localStorage.getItem("discrete-sync-v1")!).pending[
              "theory/1"
            ]?.value.status,
        ),
      )
      .toBe("known");
    await b.page
      .getByLabel("Статус вопроса 1", { exact: true })
      .selectOption("new");
    await expect.poll(() => cloud.rows(u1).get("theory/1")?.revision).toBe(2);
    await a.context.setOffline(false);
    await expect(a.page.locator(".sync-badge")).toContainText("Нужна проверка");
    await settings(a.page);
    await expect(a.page.locator(".sync-conflicts .sync-conflict")).toHaveCount(
      1,
    );
    await a.page
      .getByRole("button", {
        name: "Оставить на устройстве: Знаю",
        exact: true,
      })
      .click();
    await expect
      .poll(() => cloud.rows(u1).get("theory/1")?.value.status)
      .toBe("known");
    await flush(b.page);
    await expect(
      b.page.getByLabel("Статус вопроса 1", { exact: true }),
    ).toHaveValue("known");
    await a.page
      .locator("nav")
      .getByRole("button", { name: "Темы и вопросы", exact: true })
      .click();
    await a.context.setOffline(true);
    await a.page
      .getByLabel("Статус вопроса 1", { exact: true })
      .selectOption("new");
    await b.page
      .getByLabel("Статус вопроса 1", { exact: true })
      .selectOption("learning");
    await expect
      .poll(() => cloud.rows(u1).get("theory/1")?.value.status)
      .toBe("learning");
    await a.context.setOffline(false);
    await expect(a.page.locator(".sync-badge")).toContainText("Нужна проверка");
    await settings(a.page);
    await a.page
      .getByRole("button", { name: /^Взять из аккаунта: Изучаю/ })
      .click();
    await flush(a.page);
    await a.page
      .locator("nav")
      .getByRole("button", { name: "Темы и вопросы", exact: true })
      .click();
    await expect(
      a.page.getByLabel("Статус вопроса 1", { exact: true }),
    ).toHaveValue("learning");
    await a.context.setOffline(true);
    await a.page
      .getByLabel("Статус вопроса 2", { exact: true })
      .selectOption("known");
    await expect
      .poll(() =>
        a.page.evaluate(
          () =>
            Object.keys(
              JSON.parse(localStorage.getItem("discrete-sync-v1")!).pending,
            ).length,
        ),
      )
      .toBe(1);
    await a.context.setOffline(false);
    await a.page.reload();
    await expect
      .poll(() => cloud.rows(u1).get("theory/2")?.value.status)
      .toBe("known");
  } finally {
    await a.context.close();
    await b.context.close();
  }
});
test("существующий прогресс и обе истории билетов переносятся, ложная галочка сохраняется", async ({
  browser,
}) => {
  const cloud = new Cloud();
  const seed = {
    "discrete-study-v1": {
      version: 1,
      progress: { "1": { status: "known", review: false } },
      results: [
        {
          id: "theory-run",
          date: "2026-10-25T12:00:00Z",
          questionIds: ["1"],
          ratings: { "1": "known" },
        },
      ],
    },
    "discrete-practice-v1": {
      version: 1,
      progress: { "K1-1": "repeat" },
      results: [
        {
          id: "proof-run",
          date: "2026-10-25T12:00:00Z",
          itemIds: ["K1-1"],
          ratings: { "K1-1": "repeat" },
        },
      ],
    },
    "discrete-plan-v1": {
      version: 1,
      done: { "logic-1": false, "logic-2": true },
    },
  };
  const a = await device(browser, cloud, u1, seed),
    b = await device(browser, cloud);
  try {
    await expect.poll(() => cloud.rows(u1).size).toBe(6);
    const remote = await b.page.evaluate(() => ({
      theory: JSON.parse(localStorage.getItem("discrete-study-v1")!),
      practice: JSON.parse(localStorage.getItem("discrete-practice-v1")!),
      plan: JSON.parse(localStorage.getItem("discrete-plan-v1")!),
    }));
    expect(remote.theory.results[0].id).toBe("theory-run");
    expect(remote.practice.results[0].id).toBe("proof-run");
    expect(remote.plan.done["logic-1"]).toBe(false);
    expect(remote.plan.done["logic-2"]).toBe(true);
    await b.page.reload();
    await flush(b.page);
    const again = await b.page.evaluate(
      () => JSON.parse(localStorage.getItem("discrete-study-v1")!).results,
    );
    expect(again).toHaveLength(1);
  } finally {
    await a.context.close();
    await b.context.close();
  }
});
test("смена аккаунта не переносит прогресс предыдущего пользователя", async ({
  browser,
}) => {
  const cloud = new Cloud(),
    a = await device(browser, cloud);
  try {
    await a.page
      .getByLabel("Статус вопроса 1", { exact: true })
      .selectOption("known");
    await expect.poll(() => cloud.rows(u1).size).toBe(1);
    await settings(a.page);
    await a.page
      .getByRole("button", { name: "Выйти на этом устройстве" })
      .click();
    await a.page
      .getByRole("button", { name: "Email и пароль", exact: true })
      .click();
    await a.page.getByLabel("Email", { exact: true }).fill("other@example.com");
    await a.page.getByLabel("Пароль", { exact: true }).fill("fixture-password");
    await a.page.getByRole("button", { name: "Войти", exact: true }).click();
    await expect(a.page.locator(".sync-account")).toContainText(
      "other@example.com",
    );
    await flush(a.page);
    expect(cloud.rows(u2).size).toBe(0);
    await a.page
      .locator("nav")
      .getByRole("button", { name: "Темы и вопросы", exact: true })
      .click();
    await expect(
      a.page.getByLabel("Статус вопроса 1", { exact: true }),
    ).toHaveValue("new");
    await a.page
      .getByLabel("Статус вопроса 2", { exact: true })
      .selectOption("known");
    await expect.poll(() => cloud.rows(u2).size).toBe(1);
    expect(cloud.rows(u1).get("theory/1").value.status).toBe("known");
    await settings(a.page);
    await a.page
      .getByRole("button", { name: "Выйти на этом устройстве" })
      .click();
    await a.page
      .getByRole("button", { name: "Email и пароль", exact: true })
      .click();
    await a.page
      .getByLabel("Email", { exact: true })
      .fill("student@example.com");
    await a.page.getByLabel("Пароль", { exact: true }).fill("fixture-password");
    await a.page.getByRole("button", { name: "Войти", exact: true }).click();
    await expect(a.page.locator(".sync-account")).toContainText(
      "student@example.com",
    );
    await flush(a.page);
    await a.page
      .locator("nav")
      .getByRole("button", { name: "Темы и вопросы", exact: true })
      .click();
    await expect(
      a.page.getByLabel("Статус вопроса 1", { exact: true }),
    ).toHaveValue("known");
    await expect(
      a.page.getByLabel("Статус вопроса 2", { exact: true }),
    ).toHaveValue("new");
  } finally {
    await a.context.close();
  }
});
test("вход по email, установка пароля и экспорт не раскрывают токены", async ({
  browser,
}) => {
  const cloud = new Cloud(),
    context = await browser.newContext();
  await cloud.install(context);
  const page = await context.newPage();
  try {
    await page.goto("http://127.0.0.1:5175/#/discrete/course");
    await settings(page);
    await page.getByLabel("Email", { exact: true }).fill("student@example.com");
    await page
      .getByRole("button", { name: "Отправить ссылку для входа", exact: true })
      .click();
    await expect(page.getByRole("status")).toContainText(
      "Ссылка для входа отправлена",
    );
    expect(cloud.sentEmails).toEqual(["student@example.com"]);
    await page
      .getByRole("button", { name: "Email и пароль", exact: true })
      .click();
    await page.getByLabel("Пароль", { exact: true }).fill("fixture-password");
    await page.getByRole("button", { name: "Войти", exact: true }).click();
    await expect(page.locator(".sync-account")).toContainText(
      "student@example.com",
    );
    await page.locator(".sync-password-settings summary").click();
    await page
      .getByLabel("Новый пароль (не менее 8 символов)")
      .fill("new-fixture-password");
    await page
      .getByRole("button", { name: "Сохранить пароль", exact: true })
      .click();
    await expect(page.locator(".success")).toContainText("Пароль сохранён");
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Скачать резервную копию" }).click(),
    ]);
    const json = JSON.parse(readFileSync((await download.path())!, "utf8"));
    expect(json.format).toBe("discrete-progress-backup");
    expect(JSON.stringify(json)).not.toContain("access_token");
    expect(JSON.stringify(json)).not.toContain("refresh_token");
  } finally {
    await context.close();
  }
});
test("импорт копии добавляет отсутствующие отметки и синхронизирует их", async ({
  browser,
}) => {
  const cloud = new Cloud(),
    a = await device(browser, cloud);
  try {
    await a.page
      .getByLabel("Статус вопроса 1", { exact: true })
      .selectOption("learning");
    await flush(a.page);
    await settings(a.page);
    const backup = {
      format: "discrete-progress-backup",
      version: 1,
      data: {
        theory: {
          version: 1,
          progress: {
            "1": { status: "known", review: false },
            "2": { status: "known", review: false },
          },
          results: [],
        },
        practice: null,
        plan: { version: 1, done: { "logic-1": true } },
      },
    };
    await a.page
      .getByLabel("Перенести копию с другого адреса или устройства")
      .setInputFiles({
        name: "progress.json",
        mimeType: "application/json",
        buffer: Buffer.from(JSON.stringify(backup)),
      });
    await a.page
      .getByRole("button", { name: "Добавить прогресс из копии" })
      .click();
    await flush(a.page);
    expect(cloud.rows(u1).get("theory/1").value.status).toBe("learning");
    expect(cloud.rows(u1).get("theory/2").value.status).toBe("known");
    expect(cloud.rows(u1).get("plan/logic-1").value).toBe(true);
  } finally {
    await a.context.close();
  }
});


test("calculus sync merges independent fields on two devices, preserves discrete progress, and resolves a real same-field conflict", async ({ browser }) => {
  const cloud = new Cloud();
  const a = await device(browser, cloud), b = await device(browser, cloud);
  const target = "/#/calculus/definition?item=def-bounds";
  for (const device of [a, b]) {
    await device.page.goto("http://127.0.0.1:5175" + target);
    await expect(device.page.locator(".reading")).toBeVisible();
  }
  await a.page.getByRole("button", { name: "Знаю", exact: true }).click();
  await expect.poll(() => cloud.rows(u1 + "/calculus").get("rating/def-bounds")?.value).toBe("known");
  await b.page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect.poll(() => b.page.evaluate(() => JSON.parse(localStorage.getItem("predel-v1")!).ratings["def-bounds"])).toBe("known");
  await b.page.locator(".reading textarea").fill("Черновик со второго устройства");
  await expect.poll(() => cloud.rows(u1 + "/calculus").get("draft/def-bounds")?.value).toBe("Черновик со второго устройства");
  await a.page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(a.page.locator(".reading textarea")).toHaveValue("Черновик со второго устройства");
  await b.context.setOffline(true);
  await b.page.getByRole("button", { name: "Повторить", exact: true }).click();
  await a.page.getByRole("button", { name: "Частично", exact: true }).click();
  await expect.poll(() => cloud.rows(u1 + "/calculus").get("rating/def-bounds")?.value).toBe("partial");
  await b.context.setOffline(false);
  await b.page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await b.page.locator(".sidebar").getByRole("button", { name: "Синхронизация", exact: true }).click();
  await expect(b.page.locator('[data-conflict="rating/def-bounds"]')).toBeVisible();
  await b.page.locator('[data-conflict="rating/def-bounds"]').getByRole("button", { name: "Взять из аккаунта" }).click();
  await expect.poll(() => b.page.evaluate(() => JSON.parse(localStorage.getItem("predel-v1")!).ratings["def-bounds"])).toBe("partial");
  expect(cloud.rows(u1).has("rating/def-bounds")).toBe(false);
  await a.context.close(); await b.context.close();
});
