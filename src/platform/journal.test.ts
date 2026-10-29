import { describe, expect, it } from "vitest";
import { materials, materialKey } from "./catalog";
import { recoveryQueue } from "./journal";
import { validatePlatform, type PlatformSaved } from "./platform-state";
describe("separate recovery history", () => {
  const material = materials[0];
  const journal = [{ material, ticketId: "latest", date: "2026-10-29T10:00:00Z", label: "Повторить" }, { material, ticketId: "earlier", date: "2026-10-28T10:00:00Z", label: "Повторить" }];
  it("deduplicates the queue without modifying original ticket history", () => {
    expect(recoveryQueue(journal, { version: 1, bookmarks: [] })).toHaveLength(1);
    expect(journal).toHaveLength(2);
  });
  it("resolves only the reviewed occurrence and reopens a new later difficulty", () => {
    const p: PlatformSaved = { version: 1, bookmarks: [], sessions: [{ id: "s1", started: "2026-10-29T11:00:00Z", entries: [{ materialKey: materialKey(material), sourceTicketId: "latest", rating: "understood", date: "2026-10-29T11:01:00Z" }] }] };
    expect(recoveryQueue(journal, p)).toEqual([]);
    expect(recoveryQueue([{ ...journal[0], ticketId: "new-ticket", date: "2026-10-30T10:00:00Z" }, ...journal], p)).toHaveLength(1);
    p.sessions![0].entries[0].rating = "again";
    expect(recoveryQueue(journal, p)).toHaveLength(1);
  });
  it("accepts old bookmark-only saves, preserves false outcomes and rejects invented material IDs", () => {
    expect(validatePlatform({ version: 1, bookmarks: [] })).toEqual({ version: 1, bookmarks: [] });
    expect(() => validatePlatform({ version: 1, bookmarks: [], sessions: [{ id: "s", started: "bad-date", entries: [] }] })).toThrow();
    expect(() => validatePlatform({ version: 1, bookmarks: ["calculus/theory/fake"] })).toThrow();
  });
});
