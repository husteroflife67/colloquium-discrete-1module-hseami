-- Additive migration: leaves every discrete row, revision and RPC unchanged.
create or replace function public.calculus_progress_value_valid(k text, v jsonb)
returns boolean language plpgsql immutable set search_path = '' as $$
declare
 kind text := split_part(k,'/',1);
 item_id text := split_part(k,'/',2);
 score numeric;
 total numeric := 0;
 pos integer := 0;
 caps numeric[] := array[0.5,0.5,0.5,0.5,1,3,2];
 element jsonb;
begin
 if k !~ '^(rating|draft|schedule|checklist|question|history|setting)/[A-Za-z0-9_.-]{1,100}$' then return false; end if;
 if kind = 'checklist' and item_id !~ '^[1-8]$' then return false; end if;
 if kind = 'setting' and item_id <> 'theme' then return false; end if;
 if v = '{"deleted":true}'::jsonb then return kind <> 'setting'; end if;
 if kind in ('rating','question') then return jsonb_typeof(v) = 'string' and v #>> '{}' in ('unknown','partial','known','repeat'); end if;
 if kind = 'draft' then return jsonb_typeof(v) = 'string' and length(v #>> '{}') <= 100000; end if;
 if kind = 'setting' then return jsonb_typeof(v) = 'string' and v #>> '{}' in ('light','dark'); end if;
 if kind = 'checklist' then
  if jsonb_typeof(v->'values') is distinct from 'array' or jsonb_array_length(v->'values') <> 7 then return false; end if;
  return not exists (select from jsonb_array_elements(v->'values') x where jsonb_typeof(x) <> 'boolean');
 end if;
 if kind = 'schedule' then
  return jsonb_typeof(v) = 'object' and jsonb_typeof(v->'due') = 'number' and (v->>'due')::numeric >= 0
   and jsonb_typeof(v->'lastReviewed') = 'number' and (v->>'lastReviewed')::numeric >= 0
   and jsonb_typeof(v->'intervalDays') = 'number' and (v->>'intervalDays')::numeric > 0
   and (v->>'streak')::numeric between 0 and 5 and mod((v->>'streak')::numeric,1) = 0
   and v->>'lastRating' in ('unknown','partial','known','repeat');
 end if;
 if kind = 'history' then
  if v->>'id' is distinct from item_id or jsonb_typeof(v->'date') is distinct from 'string'
   or jsonb_typeof(v->'scores') is distinct from 'array' or jsonb_array_length(v->'scores') <> 7
   or jsonb_typeof(v->'ticket') is distinct from 'object'
   or jsonb_typeof(v->'ticket'->'definitionIds') is distinct from 'array' or jsonb_array_length(v->'ticket'->'definitionIds') <> 4
   or jsonb_typeof(v->'ticket'->'seed') is distinct from 'number'
   or jsonb_typeof(v->'ticket'->'taskId') is distinct from 'string'
   or jsonb_typeof(v->'ticket'->'shortId') is distinct from 'string'
   or jsonb_typeof(v->'ticket'->'theoryId') is distinct from 'string'
   or v->'ticket'->>'taskId' = v->'ticket'->>'shortId'
   or jsonb_typeof(v->'weak') is distinct from 'array'
   or jsonb_typeof(v->'base') is distinct from 'number'
   or jsonb_typeof(v->'extra') is distinct from 'number'
   or jsonb_typeof(v->'duration') is distinct from 'number' or (v->>'duration')::numeric < 0
   or jsonb_typeof(v->'hints') is distinct from 'number' or (v->>'hints')::numeric < 0 or mod((v->>'hints')::numeric,1) <> 0 then return false; end if;
  perform (v->>'date')::timestamptz;
  if (select count(distinct x) from jsonb_array_elements(v->'ticket'->'definitionIds') x) <> 4 then return false; end if;
  if exists (select from jsonb_array_elements(v->'ticket'->'definitionIds') x where jsonb_typeof(x) <> 'string') then return false; end if;
  for element in select value from jsonb_array_elements(v->'scores') loop
   pos := pos + 1;
   if jsonb_typeof(element) <> 'number' then return false; end if;
   score := (element #>> '{}')::numeric;
   if score < 0 or score > caps[pos] or mod(score * 2,1) <> 0 then return false; end if;
   total := total + score;
  end loop;
  return (v->>'base')::numeric = total and (v->>'extra')::numeric between 0 and case when total <= 6 then 1 else 2 end and mod((v->>'extra')::numeric * 2,1) = 0;
 end if;
 return false;
exception when others then return false;
end;
$$;
revoke all on function public.calculus_progress_value_valid(text,jsonb) from public, anon, authenticated;

-- Run once in the Supabase SQL Editor. No service-role key is used by the app.
create table if not exists public.calculus_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  key text not null check (key ~ '^(rating|draft|schedule|checklist|question|history|setting)/[A-Za-z0-9_.-]{1,100}$'),
  value jsonb not null,
  revision bigint not null default 1 check (revision > 0),
  mutation_id uuid not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);
alter table public.calculus_progress enable row level security;
drop policy if exists own_calculus_progress on public.calculus_progress;
create policy own_calculus_progress on public.calculus_progress for select to authenticated
using ((select auth.uid()) = user_id);
revoke all on public.calculus_progress from anon, authenticated;
grant select on public.calculus_progress to authenticated;

create or replace function public.sync_calculus_progress(p_changes jsonb default '[]'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  change jsonb;
  row_value public.calculus_progress%rowtype;
  change_key text;
  change_value jsonb;
  mutation uuid;
  expected bigint;
  ticket_ids jsonb;
  ticket_id jsonb;
  rating text;
  accepted jsonb := '[]'::jsonb;
  conflicts jsonb := '[]'::jsonb;
  rows_json jsonb;
begin
  if uid is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if p_changes is null or jsonb_typeof(p_changes) <> 'array' or jsonb_array_length(p_changes) > 500 then
    raise exception 'Invalid changes';
  end if;
  -- Serialize requests for this account, including insertion of previously absent keys.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(uid::text || '/calculus', 0));
  for change in select value from jsonb_array_elements(p_changes) loop
    change_key := change->>'key';
    change_value := change->'value';
    if change_key is null or change_key !~ '^(rating|draft|schedule|checklist|question|history|setting)/[A-Za-z0-9_.-]{1,100}$'
       or change_value is null or change_value = 'null'::jsonb
       or pg_catalog.octet_length(change_value::text) > 524288
       or change->>'mutation_id' is null or change->>'base_revision' is null then raise exception 'Invalid change'; end if;
    mutation := (change->>'mutation_id')::uuid;
    expected := (change->>'base_revision')::bigint;
    if expected < 0 then raise exception 'Invalid revision'; end if;
    if public.calculus_progress_value_valid(change_key, change_value) is distinct from true then raise exception 'Invalid calculus value'; end if;
    select * into row_value from public.calculus_progress where user_id = uid and key = change_key;
    if found and row_value.mutation_id = mutation then
      accepted := accepted || jsonb_build_array(mutation::text);
    elsif found and row_value.value = change_value then
      accepted := accepted || jsonb_build_array(mutation::text);
    elsif coalesce(row_value.revision,0) = expected then
      insert into public.calculus_progress (user_id,key,value,revision,mutation_id)
        values (uid,change_key,change_value,1,mutation)
        on conflict (user_id,key) do update set value=excluded.value,
          revision=public.calculus_progress.revision+1,mutation_id=excluded.mutation_id,updated_at=now();
      accepted := accepted || jsonb_build_array(mutation::text);
    else
      conflicts := conflicts || jsonb_build_array(change_key);
    end if;
  end loop;
  select coalesce(jsonb_agg(jsonb_build_object('key',key,'value',value,'revision',revision,'mutation_id',mutation_id) order by key),'[]'::jsonb)
    into rows_json from public.calculus_progress where user_id = uid;
  return jsonb_build_object('rows',rows_json,'accepted',accepted,'conflicts',conflicts);
end;
$$;
revoke all on function public.sync_calculus_progress(jsonb) from public, anon;
grant execute on function public.sync_calculus_progress(jsonb) to authenticated;
