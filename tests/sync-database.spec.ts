import { test, expect } from "@playwright/test";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
const u1 = "11111111-1111-4111-8111-111111111111",
  u2 = "22222222-2222-4222-8222-222222222222";
let db: PGlite;
test.describe("Supabase migration on PostgreSQL", () => {
  test.describe.configure({ mode: "serial" });
  test.beforeAll(async () => {
    db = new PGlite();
    await db.exec(
      `create schema auth;create table auth.users(id uuid primary key);create role anon;create role authenticated;create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;insert into auth.users values ('${u1}'),('${u2}');`,
    );
    await db.exec(
      readFileSync(
        "supabase/migrations/202610250001_progress_sync.sql",
        "utf8",
      ),
    );
  });
  test.afterAll(async () => await db.close());
  test.beforeEach(async () => await db.exec("truncate public.study_progress"));
  async function sync(uid: string, changes: any[]) {
    return db.transaction(async (tx) => {
      await tx.exec("set local role authenticated");
      await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [
        uid,
      ]);
      const result = await tx.query<{ data: any }>(
        "select public.sync_study_progress($1::jsonb) as data",
        [JSON.stringify(changes)],
      );
      return result.rows[0].data;
    });
  }
  const change = (key: string, value: any, revision = 0) => ({
    key,
    value,
    base_revision: revision,
    mutation_id: randomUUID(),
  });
  test("different fields merge, stale same-field edits conflict and retries are idempotent", async () => {
    const a = change("plan/logic-1", true),
      b = change("theory/1", { status: "known", review: false });
    await sync(u1, [a]);
    let result = await sync(u1, [b]);
    expect(result.rows).toHaveLength(2);
    expect(result.conflicts).toEqual([]);
    result = await sync(u1, [a]);
    expect(result.accepted).toEqual([a.mutation_id]);
    expect(result.rows.find((r: any) => r.key === a.key).revision).toBe(1);
    const stale = change("plan/logic-1", false);
    result = await sync(u1, [stale]);
    expect(result.conflicts).toEqual(["plan/logic-1"]);
    expect(result.rows.find((r: any) => r.key === a.key).value).toBe(true);
    result = await sync(u1, [{ ...stale, base_revision: 1 }]);
    expect(result.conflicts).toEqual([]);
    expect(result.rows.find((r: any) => r.key === a.key).revision).toBe(2);
    expect(result.rows.find((r: any) => r.key === a.key).value).toBe(false);
    result = await sync(u1, [a]);
    expect(result.conflicts).toEqual(["plan/logic-1"]);
    expect(result.rows.find((r: any) => r.key === a.key).value).toBe(false);
  });
  test("equal values need no conflict and false checkboxes remain explicit", async () => {
    await sync(u1, [change("plan/logic-2", false)]);
    const result = await sync(u1, [change("plan/logic-2", false)]);
    expect(result.conflicts).toEqual([]);
    expect(result.rows[0].value).toBe(false);
    expect(result.rows[0].revision).toBe(1);
  });
  test("two users are isolated by RLS and RPC, callers cannot choose another owner", async () => {
    await sync(u1, [
      { ...change("practice/K1-1", "independent"), user_id: u2 },
    ]);
    expect((await sync(u2, [])).rows).toEqual([]);
    await sync(u2, [change("practice/K1-1", "repeat")]);
    const a = await sync(u1, []),
      b = await sync(u2, []);
    expect(a.rows[0].value).toBe("independent");
    expect(b.rows[0].value).toBe("repeat");
    const direct = await db.transaction(async (tx) => {
      await tx.exec("set local role authenticated");
      await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [
        u1,
      ]);
      return tx.query<{ user_id: string }>(
        "select user_id from public.study_progress",
      );
    });
    expect(direct.rows.map((r) => r.user_id)).toEqual([u1]);
    await expect(
      db.transaction(async (tx) => {
        await tx.exec("set local role authenticated");
        await tx.exec("delete from public.study_progress");
      }),
    ).rejects.toThrow(/permission denied/i);
  });
  test("anonymous access and unauthenticated RPC are rejected", async () => {
    await expect(sync("", [])).rejects.toThrow("Authentication required");
    await expect(
      db.transaction(async (tx) => {
        await tx.exec("set local role anon");
        await tx.query("select public.sync_study_progress($1::jsonb)", ["[]"]);
      }),
    ).rejects.toThrow(/permission denied/i);
  });
  test("server validates schemas, revisions, and completed ticket ratings", async () => {
    for (const invalid of [
      change("plan/bad", "true"),
      change("practice/bad", "admin"),
      change("theory/1", { status: "known" }),
      change("other/test", true),
      change("plan/x", true, -1),
      change("theory-ticket/x", {
        id: "x",
        date: "2026-10-25T12:00:00Z",
        questionIds: ["1"],
        ratings: { "1": "wrong" },
      }),
    ])
      await expect(sync(u1, [invalid])).rejects.toThrow();
    const ticket = {
      id: "ticket1",
      date: "2026-10-25T12:00:00.000Z",
      questionIds: ["1", "2"],
      ratings: { "1": "known", "2": "repeat" },
    };
    const result = await sync(u1, [change("theory-ticket/ticket1", ticket)]);
    expect(result.rows[0].value).toEqual(ticket);
  });
  test("a rejected batch rolls back all its changes and migration can run twice", async () => {
    await expect(
      sync(u1, [change("plan/logic-1", true), change("plan/logic-2", "bad")]),
    ).rejects.toThrow();
    expect((await sync(u1, [])).rows).toEqual([]);
    await db.exec(
      readFileSync(
        "supabase/migrations/202610250001_progress_sync.sql",
        "utf8",
      ),
    );
  });
  test("calculus migration preserves discrete rows and isolates calculus accounts, conflicts and reset tombstones", async () => {
    await sync(u1, [change("theory/1", { status: "known", review: false })]);
    const migration = readFileSync("supabase/migrations/202610290001_calculus_progress.sql", "utf8");
    await db.exec(migration);
    await db.exec(migration);
    const calculusSync = (uid: string, changes: any[]) => db.transaction(async tx => {
      await tx.exec("set local role authenticated");
      await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [uid]);
      return (await tx.query<{ data: any }>("select public.sync_calculus_progress($1::jsonb) as data", [JSON.stringify(changes)])).rows[0].data;
    });
    const a = change("rating/def-field", "known");
    const first = await calculusSync(u1, [a]);
    expect(first.rows[0].revision).toBe(1);
    expect((await calculusSync(u1, [a])).accepted).toEqual([a.mutation_id]);
    expect((await calculusSync(u1, [change(a.key, "repeat")])).conflicts).toEqual([a.key]);
    expect((await calculusSync(u2, [])).rows).toEqual([]);
    const reset = await calculusSync(u1, [change(a.key, { deleted: true }, 1)]);
    expect(reset.rows[0].value).toEqual({ deleted: true });
    expect(reset.rows[0].revision).toBe(2);
    expect((await sync(u1, [])).rows[0].value).toEqual({ status: "known", review: false });
    for (const invalid of [change("rating/x", "admin"), change("checklist/9", { values: [] }), change("schedule/x", { due: 2 }), change("history/x", { id: "x" }), change("setting/theme", { deleted: true })]) await expect(calculusSync(u1, [invalid])).rejects.toThrow();
    await expect(calculusSync("", [])).rejects.toThrow("Authentication required");
    await expect(db.transaction(async tx => { await tx.exec("set local role anon"); await tx.query("select public.sync_calculus_progress('[]'::jsonb)"); })).rejects.toThrow(/permission denied/i);
  });

});
