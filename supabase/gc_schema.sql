-- GC Rating System — schema for the shared Legacy Supabase project
--
-- Everything here is prefixed gc_ and touches nothing else in the project.
-- Run top to bottom in the SQL editor; it is safe to re-run.
--
-- Access model: RLS on, `authenticated` only, no anon access. The caller's Azure object ID is read
-- from the `oid` claim of the verified Microsoft token via auth.jwt(). That only works if Supabase is
-- set up to accept Entra ID tokens as logins (third-party auth) so the request runs as `authenticated`
-- and the claim is visible. Without that, every policy below denies everything.

-- ---------------------------------------------------------------------------
-- gc_project_managers
-- ---------------------------------------------------------------------------
create table if not exists gc_project_managers (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  email text,
  -- Null for legacy rows that predate sign-in; set when a person creates their own row.
  azure_oid text unique,
  created_at timestamptz default now()
);

-- ---------------------------------------------------------------------------
-- gc_contractors
-- ---------------------------------------------------------------------------
create table if not exists gc_contractors (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  aliases text,
  project_award_probability numeric,
  award_probability float,
  hit_rate_dollar numeric,
  est_relationship numeric,
  total_bids numeric,
  total_bids_submitted_raw numeric,
  created_at timestamptz default now()
);

-- ---------------------------------------------------------------------------
-- gc_ratings
-- ---------------------------------------------------------------------------
create table if not exists gc_ratings (
  id uuid primary key default gen_random_uuid(),
  gc_id uuid not null references gc_contractors(id),
  pm_id uuid not null references gc_project_managers(id),
  job_number text not null,
  job_name text,
  payment_timeline integer check (payment_timeline between 1 and 5),
  co_approval_timeline integer check (co_approval_timeline between 1 and 5),
  co_negotiations integer check (co_negotiations between 1 and 5),
  contract_terms integer check (contract_terms between 1 and 5),
  conflict_mitigation integer check (conflict_mitigation between 1 and 5),
  schedule_trade_stacking integer check (schedule_trade_stacking between 1 and 5),
  schedule_accuracy integer check (schedule_accuracy between 1 and 5),
  site_control integer check (site_control between 1 and 5),
  relationship integer check (relationship between 1 and 5),
  -- Nullable so reports from before Safety existed are left out of averages instead of counted as zero.
  safety integer check (safety is null or safety between 1 and 5),
  created_at timestamptz default now()
);

-- Every score is nullable: NULL means "N/A" (the question did not apply), and averages skip it.
-- create table above does not change an existing table, so this loosens one that already exists.
alter table gc_ratings
  alter column payment_timeline drop not null,
  alter column co_approval_timeline drop not null,
  alter column co_negotiations drop not null,
  alter column contract_terms drop not null,
  alter column conflict_mitigation drop not null,
  alter column schedule_trade_stacking drop not null,
  alter column schedule_accuracy drop not null,
  alter column site_control drop not null,
  alter column relationship drop not null;

-- One person per email, so gc_link_pm can match an email to exactly one row.
create unique index if not exists gc_project_managers_email_key
  on gc_project_managers (lower(email)) where email is not null;

create index if not exists gc_ratings_gc_id_idx on gc_ratings(gc_id);
create index if not exists gc_ratings_pm_id_idx on gc_ratings(pm_id);
create index if not exists gc_ratings_created_at_idx on gc_ratings(created_at desc);

-- ---------------------------------------------------------------------------
-- gc_bid_thresholds: single-row config for the Total Bids score. Each tier_N_min is the minimum bid
-- dollars that earns a score of N on the dashboard.
-- ---------------------------------------------------------------------------
create table if not exists gc_bid_thresholds (
  id integer primary key default 1,
  tier_2_min numeric not null default 1,
  tier_3_min numeric not null default 1000000,
  tier_4_min numeric not null default 5000000,
  tier_5_min numeric not null default 10000000,
  updated_at timestamptz default now(),
  constraint gc_bid_thresholds_single_row check (id = 1)
);

insert into gc_bid_thresholds (id) values (1) on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Privileges: nothing for anon; authenticated may select and insert, plus update on gc_contractors only
-- (RLS narrows that further). Nobody can delete.
-- ---------------------------------------------------------------------------
revoke all on gc_project_managers, gc_contractors, gc_ratings, gc_bid_thresholds from anon;
revoke all on gc_project_managers, gc_contractors, gc_ratings, gc_bid_thresholds from authenticated;
grant select, insert on gc_project_managers, gc_contractors, gc_ratings to authenticated;
grant update on gc_contractors to authenticated;
grant select, insert, update on gc_bid_thresholds to authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table gc_project_managers enable row level security;
alter table gc_contractors enable row level security;
alter table gc_ratings enable row level security;
alter table gc_bid_thresholds enable row level security;

drop policy if exists "gc_pm select" on gc_project_managers;
create policy "gc_pm select" on gc_project_managers
  for select to authenticated
  using (true);

drop policy if exists "gc_pm insert own" on gc_project_managers;
create policy "gc_pm insert own" on gc_project_managers
  for insert to authenticated
  with check (
    azure_oid = (select auth.jwt() ->> 'oid')
    and (email is null or lower(email) = lower((select auth.jwt() ->> 'email')))
  );

drop policy if exists "gc_contractors select" on gc_contractors;
create policy "gc_contractors select" on gc_contractors
  for select to authenticated
  using (true);

-- Any signed-in user may add or edit contractors (add-GC modal, CSV bid-data upload).
drop policy if exists "gc_contractors insert" on gc_contractors;
create policy "gc_contractors insert" on gc_contractors
  for insert to authenticated
  with check (true);

drop policy if exists "gc_contractors update" on gc_contractors;
create policy "gc_contractors update" on gc_contractors
  for update to authenticated
  using (true)
  with check (true);

drop policy if exists "gc_ratings select" on gc_ratings;
create policy "gc_ratings select" on gc_ratings
  for select to authenticated
  using (true);

drop policy if exists "gc_ratings insert own pm" on gc_ratings;
create policy "gc_ratings insert own pm" on gc_ratings
  for insert to authenticated
  with check (
    exists (
      select 1
      from gc_project_managers pm
      where pm.id = gc_ratings.pm_id
        and pm.azure_oid = (select auth.jwt() ->> 'oid')
    )
  );

-- Thresholds are one shared row that any signed-in user may read and change (the dashboard's
-- Thresholds modal upserts it).
drop policy if exists "gc_bid_thresholds select" on gc_bid_thresholds;
create policy "gc_bid_thresholds select" on gc_bid_thresholds
  for select to authenticated
  using (true);

drop policy if exists "gc_bid_thresholds insert" on gc_bid_thresholds;
create policy "gc_bid_thresholds insert" on gc_bid_thresholds
  for insert to authenticated
  with check (id = 1);

drop policy if exists "gc_bid_thresholds update" on gc_bid_thresholds;
create policy "gc_bid_thresholds update" on gc_bid_thresholds
  for update to authenticated
  using (true)
  with check (id = 1);

-- ---------------------------------------------------------------------------
-- gc_merge_pm: repoint every rating from old_id to new_id, then delete the old PM row.
-- Returns how many ratings were moved.
--
-- Runs as the function owner (nobody has update/delete policies), so it checks the caller itself:
--   * direct database access and the service-role key may merge any two rows;
--   * a signed-in user may only merge INTO their own row, and only FROM a row that is either
--     unclaimed (azure_oid is null, i.e. a legacy PM) or already theirs.
-- Anon cannot execute it.
-- ---------------------------------------------------------------------------
create or replace function gc_merge_pm(old_id uuid, new_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_oid text := auth.jwt() ->> 'oid';
  caller_role text := auth.role();
  is_admin boolean := caller_role is null or caller_role = 'service_role';
  old_oid text;
  new_oid text;
  moved integer;
begin
  if old_id = new_id then
    raise exception 'gc_merge_pm: old_id and new_id are the same';
  end if;

  select azure_oid into old_oid from public.gc_project_managers where id = old_id for update;
  if not found then
    raise exception 'gc_merge_pm: no project manager with id %', old_id;
  end if;

  select azure_oid into new_oid from public.gc_project_managers where id = new_id for update;
  if not found then
    raise exception 'gc_merge_pm: no project manager with id %', new_id;
  end if;

  if not is_admin then
    if caller_oid is null or new_oid is distinct from caller_oid then
      raise exception 'gc_merge_pm: you can only merge into your own project manager row';
    end if;
    if old_oid is not null and old_oid <> caller_oid then
      raise exception 'gc_merge_pm: that project manager belongs to someone else';
    end if;
  end if;

  update public.gc_ratings set pm_id = new_id where pm_id = old_id;
  get diagnostics moved = row_count;

  delete from public.gc_project_managers where id = old_id;

  return moved;
end;
$$;

revoke all on function gc_merge_pm(uuid, uuid) from public, anon;
grant execute on function gc_merge_pm(uuid, uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- gc_link_pm: called on every sign-in. Returns the caller's project manager row (zero or one row).
--   1. If a row already carries the caller's azure_oid, that is it.
--   2. Otherwise, if an unclaimed row has the caller's email (case-insensitive), the caller's
--      azure_oid is stamped onto it. The id, and every rating on it, stay as they were. This is how
--      the migrated PMs are connected: put each person's email on their row beforehand.
--   3. Otherwise nothing is returned, and the app asks the person to create their own row.
-- Matching is by the `email` claim in the token, which falls back to the Microsoft username.
-- ---------------------------------------------------------------------------
drop function if exists gc_claim_pm(uuid);

create or replace function gc_link_pm()
returns setof public.gc_project_managers
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_oid text := auth.jwt() ->> 'oid';
  caller_email text := lower(auth.jwt() ->> 'email');
  pm public.gc_project_managers;
begin
  if caller_oid is null then
    raise exception 'gc_link_pm: not signed in';
  end if;

  select * into pm from public.gc_project_managers where azure_oid = caller_oid;
  if found then
    return next pm;
    return;
  end if;

  if caller_email is null or caller_email = '' then
    return;
  end if;

  update public.gc_project_managers
     set azure_oid = caller_oid
   where azure_oid is null
     and lower(email) = caller_email
  returning * into pm;
  if found then
    return next pm;
  end if;
end;
$$;

revoke all on function gc_link_pm() from public, anon;
grant execute on function gc_link_pm() to authenticated, service_role;
