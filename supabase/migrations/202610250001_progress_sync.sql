-- Run once in the Supabase SQL Editor. No service-role key is used by the app.
create table if not exists public.study_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  key text not null check (key ~ '^(theory|practice|plan|theory-ticket|practice-ticket)/[A-Za-z0-9_.-]{1,100}$'),
  value jsonb not null,
  revision bigint not null default 1 check (revision > 0),
  mutation_id uuid not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);
alter table public.study_progress enable row level security;
drop policy if exists own_progress on public.study_progress;
create policy own_progress on public.study_progress for select to authenticated
using ((select auth.uid()) = user_id);
revoke all on public.study_progress from anon, authenticated;
grant select on public.study_progress to authenticated;

create or replace function public.sync_study_progress(p_changes jsonb default '[]'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  change jsonb;
  row_value public.study_progress%rowtype;
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
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(uid::text, 0));
  for change in select value from jsonb_array_elements(p_changes) loop
    change_key := change->>'key';
    change_value := change->'value';
    if change_key is null or change_key !~ '^(theory|practice|plan|theory-ticket|practice-ticket)/[A-Za-z0-9_.-]{1,100}$'
       or change_value is null or change_value = 'null'::jsonb
       or pg_catalog.octet_length(change_value::text) > 65536
       or change->>'mutation_id' is null or change->>'base_revision' is null then raise exception 'Invalid change'; end if;
    mutation := (change->>'mutation_id')::uuid;
    expected := (change->>'base_revision')::bigint;
    if expected < 0 then raise exception 'Invalid revision'; end if;
    if change_key like 'plan/%' and jsonb_typeof(change_value) <> 'boolean' then raise exception 'Invalid plan value'; end if;
    if change_key like 'practice/%' and (jsonb_typeof(change_value) <> 'string' or change_value #>> '{}' not in ('unseen','working','independent','repeat')) then raise exception 'Invalid practice value'; end if;
    if change_key like 'theory/%' and (jsonb_typeof(change_value) <> 'object'
       or coalesce(change_value->>'status','') not in ('new','learning','known')
       or coalesce(jsonb_typeof(change_value->'review'),'') <> 'boolean') then raise exception 'Invalid theory value'; end if;
    if change_key like '%-ticket/%' and (jsonb_typeof(change_value) <> 'object'
       or coalesce(jsonb_typeof(change_value->'id'),'') <> 'string'
       or change_value->>'id' <> split_part(change_key,'/',2)
       or coalesce(jsonb_typeof(change_value->'date'),'') <> 'string'
       or coalesce(jsonb_typeof(change_value->'ratings'),'') <> 'object'
       or coalesce(jsonb_typeof(case when change_key like 'theory-ticket/%' then change_value->'questionIds' else change_value->'itemIds' end),'') <> 'array') then raise exception 'Invalid ticket'; end if;
    if change_key like '%-ticket/%' then
      ticket_ids := case when change_key like 'theory-ticket/%' then change_value->'questionIds' else change_value->'itemIds' end;
      if jsonb_array_length(ticket_ids) < 1 or jsonb_array_length(ticket_ids) > 500
         or (select count(distinct value) from jsonb_array_elements(ticket_ids)) <> jsonb_array_length(ticket_ids)
         or change_value->>'date' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T' then raise exception 'Invalid ticket'; end if;
      perform (change_value->>'date')::timestamptz;
      for ticket_id in select value from jsonb_array_elements(ticket_ids) loop
        if jsonb_typeof(ticket_id) <> 'string' then raise exception 'Invalid ticket'; end if;
        rating := change_value->'ratings'->>(ticket_id #>> '{}');
        if rating is null or (change_key like 'theory-ticket/%' and rating not in ('forgot','repeat','known'))
           or (change_key like 'practice-ticket/%' and rating not in ('unseen','working','independent','repeat')) then raise exception 'Invalid ticket rating'; end if;
      end loop;
    end if;
    select * into row_value from public.study_progress where user_id = uid and key = change_key;
    if found and row_value.mutation_id = mutation then
      accepted := accepted || jsonb_build_array(mutation::text);
    elsif found and row_value.value = change_value then
      accepted := accepted || jsonb_build_array(mutation::text);
    elsif coalesce(row_value.revision,0) = expected then
      insert into public.study_progress (user_id,key,value,revision,mutation_id)
        values (uid,change_key,change_value,1,mutation)
        on conflict (user_id,key) do update set value=excluded.value,
          revision=public.study_progress.revision+1,mutation_id=excluded.mutation_id,updated_at=now();
      accepted := accepted || jsonb_build_array(mutation::text);
    else
      conflicts := conflicts || jsonb_build_array(change_key);
    end if;
  end loop;
  select coalesce(jsonb_agg(jsonb_build_object('key',key,'value',value,'revision',revision,'mutation_id',mutation_id) order by key),'[]'::jsonb)
    into rows_json from public.study_progress where user_id = uid;
  return jsonb_build_object('rows',rows_json,'accepted',accepted,'conflicts',conflicts);
end;
$$;
revoke all on function public.sync_study_progress(jsonb) from public, anon;
grant execute on function public.sync_study_progress(jsonb) to authenticated;
