import { describe, expect, it } from "vitest";
import { searchAll, searchDocuments } from "./search";
import { materials } from "./catalog";
import { items } from "../calculus/content";
import { feedbackURL, materialURL } from "./material-links";
describe("cross-course search and links", () => {
  it("indexes every material and clarification exactly once", () => {
    expect(searchDocuments).toHaveLength(materials.length + items.flatMap(i => i.questions).length);
    expect(new Set(searchDocuments.map(d => d.key)).size).toBe(searchDocuments.length);
    expect(searchAll("КоШи", "calculus").length).toBeGreaterThan(0);
    expect(searchAll("индукция", "discrete").length).toBeGreaterThan(0);
  });
  it("finds text in proofs and answers, obeys both filters, and handles punctuation literally", () => {
    const doc = searchDocuments.find(d => d.kind === "oral" && d.body.includes("квантор"))!;
    expect(searchAll("квантор", "calculus", "oral").some(d => d.key === doc.key)).toBe(true);
    expect(searchAll("индукция", "discrete", "practice").every(d => d.material.course === "discrete" && d.kind === "practice")).toBe(true);
    expect(searchAll(" ")).toEqual([]);
    expect(() => searchAll("[.*(")).not.toThrow();
  });
  it("builds exact-card and exact-question links under any deployment prefix", () => {
    const m = materials.find(m => m.course === "calculus")!;
    const url = materialURL(m, "https://example.org", "/courses/", "oral-1");
    expect(url).toContain("https://example.org/courses/#/calculus/");
    expect(url).toContain(`item=${m.id}&question=oral-1`);
    const issue = new URL(feedbackURL(m, url, "Условие: a < b\nНужна проверка", "Цитата $a_n$", "oral-1"));
    expect(issue.hostname).toBe("github.com");
    expect(issue.searchParams.get("body")).toContain("Условие: a < b\nНужна проверка");
    expect(issue.searchParams.get("body")).toContain(url);
    expect(issue.searchParams.get("body")).not.toContain("ratings");
  });
});
