import { describe, expect, it } from "vitest";
import katex from "katex";
import { items, topics } from "./index";
import { extraQuestions } from "./extra-questions";
import { guideReferences, guideQuestions } from "./guide";
import { numbers } from "./numbers";
import { sequences } from "./sequences";
import { functions } from "./functions";
import { practice } from "./practice";
import { readFileSync } from "node:fs";
import {
  officialDefinitionList,
  newOfficialDefinitions,
} from "./official-definitions";

describe("Учебный корпус", () => {
  it("покрывает все 43 официальных вопроса отдельными проверенными ответами и точными ссылками", () => {
    const official = items
      .filter((i) => i.definitionNumber !== undefined)
      .sort((a, b) => a.definitionNumber! - b.definitionNumber!);
    expect(official.map((i) => i.definitionNumber)).toEqual(
      Array.from({ length: 43 }, (_, i) => i + 1),
    );
    expect(new Set(official.map((i) => i.id)).size).toBe(43);
    expect(officialDefinitionList).toHaveLength(43);
    for (const card of official) {
      expect(card.kind).toBe("definition");
      expect(card.officialPrompt!.length).toBeGreaterThan(20);
      expect(card.statement.length).toBeGreaterThan(50);
      expect(card.origin).toBe("generated");
      expect(
        card.references!.some(
          (r) =>
            r.path === "sources/definitions.pdf" &&
            r.page === (card.definitionNumber! <= 37 ? 1 : 2),
        ),
      ).toBe(true);
    }
    expect(
      items.filter(
        (i) => i.kind === "definition" && i.definitionNumber === undefined,
      ),
    ).toHaveLength(6);
    expect(
      items.find((i) => i.id === "def-bounds")?.definitionNumber,
    ).toBeUndefined();
    expect(
      items.find((i) => i.id === "def-nested")?.definitionNumber,
    ).toBeUndefined();
    expect(official[1].id).toBe("def-bounds-and-maximum");
    expect(official[11].id).toBe("def-nested-principle");
    expect(
      readFileSync(
        new URL("../../../public/sources/definitions.pdf", import.meta.url),
      )
        .subarray(0, 5)
        .toString(),
    ).toBe("%PDF-");
  });
  it("подключает дополнительный конспект без изменения объектов прогресса и программы", () => {
    const legacy = [...numbers, ...sequences, ...functions, ...practice];
    expect(items).toHaveLength(legacy.length + newOfficialDefinitions.length);
    for (const old of legacy)
      expect(items.find((i) => i.id === old.id)?.kind).toBe(old.kind);
    for (let n = 1; n <= 21; n++) {
      expect(guideReferences[n]?.length).toBeGreaterThan(0);
      for (const ref of guideReferences[n]) {
        expect(ref.path).toBe("sources/corrected-guide.pdf");
        expect(
          Number.isInteger(ref.page) && ref.page >= 1 && ref.page <= 20,
        ).toBe(true);
        expect(["2.7", "2.24", "2.25"]).not.toContain(ref.section);
      }
    }
    expect(guideReferences[6].map((r) => r.section)).toEqual(["2.6"]);
    const pdf = readFileSync(
      new URL("../../../public/sources/corrected-guide.pdf", import.meta.url),
    );
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    for (const q of guideQuestions) {
      expect(
        items
          .find((i) => i.id === q.target)
          ?.questions.filter((o) => o.id === q.id),
      ).toHaveLength(1);
    }
    const supplements = items.flatMap((i) => i.supplements ?? []);
    expect(supplements).toHaveLength(2);
    const allIds = items
      .flatMap((i) => [i.id, ...i.questions.map((q) => q.id)])
      .concat(supplements.map((s) => s.id));
    expect(new Set(allIds).size).toBe(allIds.length);
    for (const i of items)
      for (const proof of i.supplements ?? []) {
        expect(proof.topic).toBe(i.topic);
        expect(proof.program).toEqual(i.program);
        expect(proof.origin).toBe("generated");
        expect(proof.review).toBe("self_reviewed");
        expect(proof.proof.length).toBeGreaterThanOrEqual(4);
        expect(proof.review_notes.length).toBeGreaterThan(20);
        expect(
          proof.dependencies.every((id) => items.some((x) => x.id === id)),
        ).toBe(true);
      }
  });
  it("связывает каждое дополнительное уточнение с существующим объектом ровно один раз", () => {
    for (const extra of extraQuestions) {
      const parent = items.find((i) => i.id === extra.target);
      expect(parent, `Нет родителя ${extra.target}`).toBeDefined();
      expect(parent!.questions.filter((q) => q.id === extra.id)).toHaveLength(
        1,
      );
      expect(
        items.flatMap((i) => i.questions).filter((q) => q.id === extra.id),
      ).toHaveLength(1);
    }
  });
  it("покрывает все 21 вопрос и восемь тем", () => {
    expect(topics.map((t) => t.id)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    for (let n = 1; n <= 21; n++) {
      const theorem = items.find((i) => i.id === `theory-${n}`);
      expect(theorem, `Нет вопроса ${n}`).toBeDefined();
      expect(theorem?.program).toContain(n);
      expect(
        theorem?.proof.length,
        `Нет доказательства вопроса ${n}`,
      ).toBeGreaterThan(0);
    }
    for (const topic of topics)
      for (const kind of ["definition", "theory", "practice"])
        expect(
          items.some((i) => i.topic === topic.id && i.kind === kind),
          `${topic.id}/${kind}`,
        ).toBe(true);
  });
  it("содержит уникальные стабильные ID, происхождение и проверку", () => {
    const ids = items.flatMap((i) => [i.id, ...i.questions.map((q) => q.id)]);
    expect(new Set(ids).size).toBe(ids.length);
    for (const i of items) {
      expect(i.source.length).toBeGreaterThan(5);
      expect(i.review_notes.length).toBeGreaterThan(5);
      expect(
        i.program.every((n) => Number.isInteger(n) && n >= 1 && n <= 21),
      ).toBe(true);
      expect(["source", "generated", "external"]).toContain(i.origin);
      expect(["unchecked", "self_reviewed", "needs_review"]).toContain(
        i.review,
      );
      expect(i.statement.length).toBeGreaterThan(15);
      if (i.kind !== "practice")
        expect(
          i.questions.length,
          `Мало уточнений ${i.id}`,
        ).toBeGreaterThanOrEqual(3);
      for (const q of i.questions) {
        expect(q.topic).toBe(i.topic);
        expect(q.program).toEqual(i.program);
        expect(q.origin).toBe("generated");
        expect(q.source.length).toBeGreaterThan(5);
        expect(q.review).toBe("self_reviewed");
        for (const field of [
          "prompt",
          "hint",
          "answer",
          "criteria",
          "mistake",
          "review_notes",
        ] as const)
          expect(q[field].length, `${q.id}.${field}`).toBeGreaterThan(3);
      }
    }
  });
  it("не содержит отсутствующих зависимостей и циклов", () => {
    const byId = new Map(items.map((i) => [i.id, i]));
    const complete = new Set<string>();
    function visit(id: string, path: Set<string>) {
      expect(byId.has(id), `Отсутствует зависимость ${id}`).toBe(true);
      expect(path.has(id), `Цикл через ${id}`).toBe(false);
      if (complete.has(id)) return;
      const next = new Set(path).add(id);
      for (const dependency of [
        ...byId.get(id)!.dependencies,
        ...(byId.get(id)!.supplements ?? []).flatMap((s) => s.dependencies),
      ])
        visit(dependency, next);
      complete.add(id);
    }
    for (const i of items) visit(i.id, new Set());
  });
  it("рендерит все формулы KaTeX без синтаксических ошибок", () => {
    for (const item of items) {
      const serialized = JSON.stringify(item);
      // JSON-encoded strings preserve double backslashes; restore actual text first.
      const texts: string[] = [];
      function collect(value: unknown) {
        if (typeof value === "string") texts.push(value);
        else if (Array.isArray(value)) value.forEach(collect);
        else if (value && typeof value === "object")
          Object.values(value).forEach(collect);
      }
      collect(JSON.parse(serialized));
      for (const value of texts)
        for (const match of value.matchAll(/\$\$([\s\S]*?)\$\$|\$([^$\n]+)\$/g))
          expect(
            () =>
              katex.renderToString(match[1] ?? match[2], {
                throwOnError: true,
                strict: "error",
              }),
            `${item.id}: ${match[0]}`,
          ).not.toThrow();
    }
  });
});
