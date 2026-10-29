import { test, expect } from "@playwright/test";
import { readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import manifest from "../src/data/material-manifest.json" with { type: "json" };
import {
  practice,
  eligibleProofs,
  generateProofTicket,
  isOptionalClass,
  practiceKey,
  type PracticeItem,
} from "../src/practice-model";
import katex from "katex";
const options = {
  topicIds: practice.topics.map((t) => t.id),
  includeOutside: false,
  onlyReady: true,
};
async function library(page: any) {
  await page.goto("/#/discrete/course");
  await page
    .locator("nav")
    .getByRole("button", { name: "Доказательства", exact: true })
    .click();
}
async function proofMode(page: any) {
  await page.goto("/#/discrete/course");
  await page
    .locator("nav")
    .getByRole("button", { name: "Пробный билет", exact: true })
    .click();
  await page
    .getByRole("group", { name: "Режим билета" })
    .getByRole("button", { name: "На доказательство", exact: true })
    .click();
}
test("реестр: все исходные номера, источники, файлы и изображения", () => {
  const tasks = practice.items.filter((q) => q.source !== "lecture");
  expect(new Set(tasks.map((q) => q.parentNumber)).size).toBe(95);
  expect(tasks).toHaveLength(96);
  expect(practice.items.filter((q) => q.source === "lecture")).toHaveLength(49);
  expect(new Set(practice.items.map((q) => q.id)).size).toBe(
    practice.items.length,
  );
  expect(manifest.files.map((f) => f.classNumbers.length)).toEqual([
    9, 9, 8, 5, 8, 9, 6, 8, 8,
  ]);
  expect(manifest.files.map((f) => f.homeworkNumbers.length)).toEqual([
    0, 0, 0, 5, 0, 5, 5, 5, 5,
  ]);
  for (const f of manifest.files) {
    expect(
      createHash("sha256")
        .update(readFileSync(`public/materials/sheets/${f.file}`))
        .digest("hex"),
    ).toBe(f.sha256);
    expect([
      ...new Set(
        tasks
          .filter((q) => q.file === f.file && q.source === "class")
          .map((q) => q.parentNumber),
      ),
    ]).toEqual(f.classNumbers);
    expect(
      tasks
        .filter((q) => q.file === f.file && q.source === "homework")
        .map((q) => q.parentNumber),
    ).toEqual(f.homeworkNumbers);
  }
  for (const q of practice.items) {
    expect(existsSync("public" + q.originalImage)).toBeTruthy();
    expect(practice.topics.some((t) => t.id === q.topicId)).toBeTruthy();
    expect(q.page).toBeGreaterThan(0);
    for (const image of q.originalImages ?? [])
      expect(existsSync("public" + image)).toBeTruthy();
  }
  const stars = practice.items.filter(isOptionalClass);
  expect(stars).toHaveLength(8);
  expect(stars.map((q) => q.number)).toEqual([
    "К1.8",
    "К1.9",
    "К2.9",
    "К5.8",
    "К6.8",
    "К6.9",
    "К7.4б",
    "К8.8",
  ]);
  expect(tasks.find((q) => q.number === "К7.4а")?.starred).toBe(false);
  expect(tasks.find((q) => q.number === "К7.4а")?.statement).not.toContain(
    "б*)",
  );
  expect(tasks.find((q) => q.number === "Д6.5")?.statement).toContain("2^{40}");
  expect(tasks.find((q) => q.number === "К3.4")?.statement).toContain("3n+1");
  expect(tasks.find((q) => q.number === "К4.4")?.blocked).toBe(true);
});
test("генератор: только подходящие, без звёздочных классных, без повторов; домашняя звезда разрешена", () => {
  const pool = eligibleProofs(practice.items, options);
  expect(pool.length).toBeGreaterThan(50);
  expect(
    pool.every(
      (q) =>
        q.proofEligible && !q.blocked && !q.outOfScope && !isOptionalClass(q),
    ),
  ).toBeTruthy();
  for (let i = 0; i < 100; i++) {
    const ticket = generateProofTicket(practice.items, 8, options);
    expect(new Set(ticket.map((q) => q.id)).size).toBe(8);
    expect(ticket.every((q) => pool.some((p) => p.id === q.id))).toBeTruthy();
  }
  expect(() => generateProofTicket(practice.items, 999, options)).toThrow(
    "только",
  );
  expect(() => generateProofTicket(practice.items, 0, options)).toThrow(
    "целое",
  );
  expect(() => generateProofTicket(practice.items, 1.5, options)).toThrow(
    "целое",
  );
  const homeStar = {
    ...practice.items.find((q) => q.source === "homework" && q.proofEligible)!,
    id: "fixture-home-star",
    starred: true,
  };
  expect(eligibleProofs([homeStar], options)).toEqual([homeStar]);
  const classStar = { ...homeStar, source: "class" as const };
  expect(eligibleProofs([classStar], options)).toEqual([]);
  expect(
    eligibleProofs(practice.items, { ...options, topicIds: ["infinite"] }),
  ).toEqual([]);
  expect(
    eligibleProofs(practice.items, {
      ...options,
      topicIds: ["infinite"],
      includeOutside: true,
    }).length,
  ).toBeGreaterThan(0);
  expect(
    generateProofTicket([...pool, pool[0]], pool.length, options),
  ).toHaveLength(pool.length);
});
test("все формулы новых материалов корректны и нет скрытых управляющих символов", () => {
  let n = 0;
  for (const q of practice.items)
    for (const text of [
      q.statement,
      q.idea,
      ...q.prerequisites,
      ...q.steps,
      ...q.transitions,
    ]) {
      expect(/[\x00-\x08\x0e-\x1f]/.test(text), q.number).toBe(false);
      for (const m of text.matchAll(/\$([^$]+)\$/g)) {
        expect(
          () =>
            katex.renderToString(m[1], { throwOnError: true, strict: "error" }),
          q.number,
        ).not.toThrow();
        n++;
      }
    }
  expect(n).toBeGreaterThan(600);
});
test("фильтры, исходное условие, подписи решений, отметки и сохранность старого прогресса", async ({
  page,
}) => {
  await page.goto("/#/discrete/course");
  await page
    .getByLabel("Статус вопроса 1", { exact: true })
    .selectOption("known");
  await page
    .locator("nav")
    .getByRole("button", { name: "Доказательства", exact: true })
    .click();
  await page.getByRole("button", { name: "Все задания", exact: false }).click();
  await page.getByLabel("Источник задания").selectOption("homework");
  await page.getByLabel("Тип задания").selectOption("calculation");
  await expect(page.locator(".material-card")).toHaveCount(13);
  await page.getByLabel("Поиск по номеру и тексту задания").fill("Д4.1");
  await expect(page.locator(".material-card")).toHaveCount(1);
  await expect(page.locator(".material-card .material-source")).toContainText(
    "6.pdf",
  );
  await page.getByLabel("Разобрать Д4.1", { exact: true }).click();
  await expect(page.getByAltText("Оригинал условия Д4.1")).toBeVisible();
  await expect(page.locator(".practice-solution")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Показать идею", exact: true })
    .click();
  await expect(page.locator(".example")).toContainText("без повторений");
  await page
    .getByRole("button", { name: "Показать решение", exact: true })
    .click();
  await expect(page.locator(".solution-credit")).toContainText(
    "Авторское учебное решение",
  );
  await expect(page.locator(".proof-steps")).toContainText("336");
  expect(
    await page.evaluate((key) => localStorage.getItem(key), practiceKey),
  ).toBeNull();
  await page
    .getByLabel("Статус изучения", { exact: true })
    .selectOption("repeat");
  await page.reload();
  await page
    .locator("nav")
    .getByRole("button", { name: "Доказательства", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Повторение", exact: false })
    .last()
    .click();
  await expect(page.locator(".material-card")).toHaveCount(1);
  await page.getByLabel("Разобрать Д4.1", { exact: true }).click();
  await expect(page.getByLabel("Статус изучения", { exact: true })).toHaveValue(
    "repeat",
  );
  await page
    .locator("nav")
    .getByRole("button", { name: "Мой прогресс" })
    .click();
  await expect(
    page.getByRole("heading", { name: "1 из 46 вопросов — «Знаю»" }),
  ).toBeVisible();
  await expect(page.locator(".practice-progress-summary")).toContainText(
    "Нужно повторить",
  );
});
test("звёздочка подпункта, неоднозначность источника и недостающее решение видны в интерфейсе", async ({
  page,
}) => {
  await library(page);
  await page.getByRole("button", { name: "Все задания", exact: false }).click();
  await page.getByLabel("Поиск по номеру и тексту задания").fill("К7.4");
  await expect(page.locator(".material-card")).toHaveCount(1);
  await page.getByLabel("Показать необязательные классные ★").check();
  await expect(page.locator(".material-card")).toHaveCount(2);
  await page.getByLabel("Разобрать К7.4б", { exact: true }).click();
  await expect(page.locator(".condition-block")).toContainText("исключена");
  await page
    .getByRole("button", { name: "Показать решение", exact: true })
    .click();
  await expect(page.locator(".solution-credit")).toContainText(
    "Решение пока не добавлено",
  );
  await page.getByRole("button", { name: "К материалам" }).click();
  await page.getByLabel("Поиск по номеру и тексту задания").fill("Д6.5");
  await page.getByLabel("Разобрать Д6.5", { exact: true }).click();
  await expect(page.locator(".material-warning")).toContainText(
    "Домашнее задание 8",
  );
  await expect(page.locator(".material-source")).toContainText("8.pdf");
});
test("билет на доказательство: нехватка, скрытые решения, явная самооценка и история", async ({
  page,
}) => {
  await proofMode(page);
  await page.getByLabel("Количество доказательств").fill("999");
  await page
    .getByRole("button", { name: "Собрать тренировочный билет" })
    .click();
  await expect(page.getByRole("alert")).toContainText("только");
  await page.getByLabel("Количество доказательств").fill("2");
  await page
    .getByRole("button", { name: "Собрать тренировочный билет" })
    .click();
  await expect(page.locator(".proof-ticket-question")).toHaveCount(2);
  await expect(page.locator(".practice-solution")).toHaveCount(0);
  await expect(page.locator(".example")).toHaveCount(0);
  const items = page.locator(".proof-ticket-question");
  await items
    .nth(0)
    .getByRole("button", { name: "Показать идею", exact: true })
    .click();
  await expect(items.nth(0).locator(".example")).toBeVisible();
  await items
    .nth(0)
    .getByRole("button", { name: "Показать решение", exact: true })
    .click();
  expect(
    await page.evaluate((key) => localStorage.getItem(key), practiceKey),
  ).toBeNull();
  await page
    .getByRole("button", { name: "Завершить ответ и перейти к самооценке" })
    .click();
  await expect(
    page.getByRole("button", { name: "Сохранить самооценку билета" }),
  ).toBeDisabled();
  await items
    .nth(0)
    .getByRole("button", { name: "Нужно повторить", exact: true })
    .click();
  await items
    .nth(1)
    .getByRole("button", { name: "Могу доказать самостоятельно", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Сохранить самооценку билета" })
    .click();
  await expect(page.getByRole("status")).toContainText("Билет сохранён");
  const stored = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!),
    practiceKey,
  );
  expect(stored.results).toHaveLength(1);
  expect(new Set(stored.results[0].itemIds).size).toBe(2);
  expect(Object.values(stored.progress).sort()).toEqual([
    "independent",
    "repeat",
  ]);
  await page.reload();
  await page
    .locator("nav")
    .getByRole("button", { name: "Пробный билет", exact: true })
    .click();
  await page
    .getByRole("group", { name: "Режим билета" })
    .getByRole("button", { name: "На доказательство", exact: true })
    .click();
  await expect(page.locator(".practice-history .history-row")).toHaveCount(1);
  await page.locator(".practice-history .history-row").click();
  await expect(page.locator(".proof-ticket-question")).toHaveCount(2);
  await expect(
    page.getByRole("heading", { name: "Сохранённый билет" }),
  ).toBeVisible();
});
test("источники доступны, новый интерфейс на телефоне не растягивает страницу", async ({
  page,
  request,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/#/discrete/course");
  await page.getByRole("button", { name: "Открыть меню" }).click();
  await page
    .locator("nav")
    .getByRole("button", { name: "Доказательства", exact: true })
    .click();
  await page.screenshot({
    path: "/tmp/practice-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page.getByLabel("Поиск по номеру и тексту задания").fill("К1.2");
  await page.getByLabel("Разобрать К1.2", { exact: true }).click();
  await page
    .getByRole("button", { name: "Показать решение", exact: true })
    .click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  const images = await page
    .locator(".condition-images img")
    .evaluateAll((imgs) =>
      imgs.every(
        (img) =>
          (img as HTMLImageElement).complete &&
          (img as HTMLImageElement).naturalWidth > 0,
      ),
    );
  expect(images).toBeTruthy();
  for (let i = 1; i <= 9; i++) {
    const r = await request.get(`/materials/sheets/${i}.pdf`);
    expect(r.ok()).toBeTruthy();
    expect(r.headers()["content-type"]).toContain("pdf");
  }
  expect(errors).toEqual([]);
});
test("новое хранилище: повреждение и отказ записи не обрушивают приложение", async ({
  page,
}) => {
  await page.addInitScript(
    (key) => localStorage.setItem(key, "broken"),
    practiceKey,
  );
  await library(page);
  await expect(page.getByRole("alert")).toContainText("прогресс задач");
  await page.getByLabel("Поиск по номеру и тексту задания").fill("К1.1");
  await page.getByLabel("Разобрать К1.1", { exact: true }).click();
  await page
    .getByLabel("Статус изучения", { exact: true })
    .selectOption("working");
  await expect(page.getByRole("alert")).toHaveCount(0);
  await page.evaluate(() => {
    Storage.prototype.setItem = () => {
      throw Error("full");
    };
  });
  await page
    .getByLabel("Статус изучения", { exact: true })
    .selectOption("repeat");
  await expect(page.getByRole("alert")).toContainText("только до перезагрузки");
});

test('числовые решения сверены независимым перебором',()=>{
 let sixEven=0,fourDistinct=0,fourIncreasing=0,sumTwelve=0,nonIncreasingFive=0;
 for(let n=100000;n<=999999;n++)if([...String(n)].some(c=>Number(c)%2===0))sixEven++;
 for(let n=1000;n<=9999;n++){const s=String(n);if(new Set(s).size===4)fourDistinct++;if([...s].every((c,i)=>i===0||c>s[i-1]))fourIncreasing++}
 for(let n=10000;n<=99999;n++)if([...String(n)].reduce((a,c)=>a+Number(c),0)===12)sumTwelve++;
 // Generate nonincreasing seven-digit words directly instead of iterating nine million numbers.
 function digits(prefix:number[]){if(prefix.length===7){if(prefix[4]===5)nonIncreasingFive++;return}for(let x=0;x<=(prefix.at(-1)??9);x++)if(prefix.length||x>0)digits([...prefix,x])}digits([]);
 let monotoneDigits=0;function perm(prefix:number[]){if(prefix.length===10){const even=prefix.filter(n=>n%2===0),odd=prefix.filter(n=>n%2!==0);if(even.every((v,i)=>i===0||v>even[i-1])&&odd.every((v,i)=>i===0||v<odd[i-1]))monotoneDigits++;return}for(let n=0;n<10;n++)if(!prefix.includes(n))perm([...prefix,n])}perm([]);
 let spaced=0;for(let mask=0;mask<1<<15;mask++)if(mask.toString(2).replaceAll('0','').length===6&&(mask&(mask<<1))===0)spaced++;
 let boundary=0;for(let mask=0;mask<512;mask++){const lines=[[0,1,2],[6,7,8],[0,3,6],[2,5,8]];if(lines.some(line=>line.every(i=>mask&(1<<i))))boundary++}
 let candies=0;for(let a=0;a<=5;a++)for(let b=0;b<=5;b++)for(let c=0;c<=5;c++){const d=15-a-b-c;if(d>=0&&d<=5)candies++}
 let contains=0;for(let n=0;n<4096;n++)if(n.toString(2).padStart(12,'0').includes('1100'))contains++;
 let pairedFunctions=0;for(let mask=0;mask<65536;mask++){const counts=[0,0,0,0];let v=mask;for(let j=0;j<8;j++){counts[v%4]++;v=Math.floor(v/4)}if(counts.every(n=>n===2))pairedFunctions++}
 expect({sixEven,fourDistinct,fourIncreasing,sumTwelve,nonIncreasingFive,monotoneDigits,spaced,boundary,candies,contains,pairedFunctions}).toEqual({sixEven:884375,fourDistinct:4536,fourIncreasing:126,sumTwelve:1330,nonIncreasingFive:1470,monotoneDigits:252,spaced:210,boundary:190,candies:56,contains:2065,pairedFunctions:2520});
});
test('фрагменты условий скрывают доказательство и сохраняют верхние индексы',()=>{
 const q=practice.items.find(q=>q.number==='Теорема 5.3')!;const image=readFileSync('public'+q.originalImage);
 // Height in PNG IHDR: the one-line assertion occupies <150 pixels, the source proof >500.
 expect(image.readUInt32BE(20)).toBeLessThan(150);
  const sumCondition=readFileSync("public/materials/conditions/D6-5.png");
  expect(sumCondition.readUInt32BE(20)).toBeGreaterThan(95);
  const vandermonde=readFileSync("public/materials/conditions/K3-7.png");
  expect(vandermonde.readUInt32BE(20)).toBeGreaterThan(120);
});
