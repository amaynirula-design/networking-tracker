-- =============================================================================
-- Secure Networking Tracker — contacts schema, constraints and RLS policies
-- =============================================================================
-- Run this in the Neon SQL Editor AFTER enabling Managed Better Auth and the
-- Data API (the Data API is what creates the `authenticated` role that these
-- policies and grants refer to).
--
-- This file is the trusted backend. The browser talks straight to the Neon Data
-- API, so nothing enforced only in React can be relied upon: every rule that
-- actually matters — who owns a row, and what counts as a valid row — is
-- enforced here, by Postgres.
--
-- Safe to re-run.
--
-- Upgrading a database created before the date columns existed? Run:
--   alter table public.contacts add column if not exists met_on date;
--   alter table public.contacts add column if not exists follow_up_on date;
-- then re-run this file to pick up the constraints and the partial index, and
-- finally reload the Data API's schema cache or writes to the new columns will
-- fail with "could not find the column ... in the schema cache":
--   notify pgrst, 'reload schema';
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Table
-- -----------------------------------------------------------------------------
create table if not exists public.contacts (
  id         uuid        primary key default gen_random_uuid(),

  -- Ownership. `auth.user_id()` returns the `sub` claim of the caller's JWT as
  -- text. Defaulting the column means the client never supplies user_id on an
  -- insert, and NOT NULL means an unauthenticated caller (where auth.user_id()
  -- is NULL) cannot create a row at all.
  user_id    text        not null default auth.user_id(),

  name       text        not null,
  company    text,
  role       text,
  met_at     text,                     -- where you met them (free text)
  met_on     date,                     -- when you met them (calendar day, no time zone)
  follow_up_on date,                   -- when to get back in touch
  notes      text,
  priority   text        not null default 'medium',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Validation, enforced by the database rather than by the client.
  constraint contacts_name_not_blank  check (length(btrim(name)) > 0),
  constraint contacts_name_len        check (length(name) <= 120),
  constraint contacts_company_len     check (company is null or length(company) <= 120),
  constraint contacts_role_len        check (role    is null or length(role)    <= 120),
  constraint contacts_met_at_len      check (met_at  is null or length(met_at)  <= 160),
  constraint contacts_notes_len       check (notes   is null or length(notes)   <= 2000),
  constraint contacts_priority_valid  check (priority in ('high', 'medium', 'low')),
  constraint contacts_user_not_blank  check (length(btrim(user_id)) > 0),

  -- Dates are stored as `date`, not `timestamptz`. "The day I met them" has no
  -- time zone; storing an instant would shift the day for a travelling user.
  constraint contacts_met_on_range check (
    met_on is null or (met_on >= date '1900-01-01' and met_on <= date '2100-01-01')
  ),
  constraint contacts_follow_up_on_range check (
    follow_up_on is null
    or (follow_up_on >= date '1900-01-01' and follow_up_on <= date '2100-01-01')
  )
);

-- Sorting by the `priority` text column alphabetically gives high, low, medium,
-- which is meaningless. This generated column lets the database sort by actual
-- urgency, so ordering stays correct and stays server-side.
alter table public.contacts
  add column if not exists priority_rank int
  generated always as (
    case priority when 'high' then 1 when 'medium' then 2 else 3 end
  ) stored;

-- Every query is filtered by user_id via RLS, so this is the index that matters.
create index if not exists contacts_user_id_idx      on public.contacts (user_id);
create index if not exists contacts_user_created_idx on public.contacts (user_id, created_at desc);

-- Partial index: the "what do I owe today" query only ever looks at rows that
-- actually have a follow-up date, which is a small slice of the table.
create index if not exists contacts_follow_up_idx
  on public.contacts (user_id, follow_up_on)
  where follow_up_on is not null;

-- -----------------------------------------------------------------------------
-- 2. Keep updated_at honest
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists contacts_set_updated_at on public.contacts;
create trigger contacts_set_updated_at
  before update on public.contacts
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 3. Row Level Security
-- -----------------------------------------------------------------------------
-- Without this, the Data API would expose every row to every signed-in user.
alter table public.contacts enable row level security;

-- Also apply RLS to the table owner, so a mistake elsewhere cannot bypass it.
alter table public.contacts force row level security;

drop policy if exists contacts_select_own on public.contacts;
drop policy if exists contacts_insert_own on public.contacts;
drop policy if exists contacts_update_own on public.contacts;
drop policy if exists contacts_delete_own on public.contacts;

-- Four separate policies, one per operation.
-- USING  → which existing rows this operation may see/touch.
-- WITH CHECK → what the row is allowed to look like afterwards.

create policy contacts_select_own on public.contacts
  for select to authenticated
  using (auth.user_id() = user_id);

create policy contacts_insert_own on public.contacts
  for insert to authenticated
  with check (auth.user_id() = user_id);

-- USING stops you editing someone else's row; WITH CHECK stops you rewriting
-- your own row so that it belongs to someone else.
create policy contacts_update_own on public.contacts
  for update to authenticated
  using (auth.user_id() = user_id)
  with check (auth.user_id() = user_id);

create policy contacts_delete_own on public.contacts
  for delete to authenticated
  using (auth.user_id() = user_id);

-- -----------------------------------------------------------------------------
-- 4. Grants
-- -----------------------------------------------------------------------------
-- `authenticated` is the role the Data API assumes for a caller with a valid
-- JWT. RLS above narrows these table-wide grants down to the caller's own rows.
grant usage on schema public to authenticated;
grant select, insert, update, delete on public.contacts to authenticated;

-- Deliberately NOT granted to `anonymous`: a signed-out visitor must not be
-- able to read or write contacts at all.
revoke all on public.contacts from anonymous;

-- -----------------------------------------------------------------------------
-- 5. Verification — run these to confirm the security posture
-- -----------------------------------------------------------------------------
-- Expect rowsecurity = true:
--   select relname, relrowsecurity, relforcerowsecurity
--     from pg_class where relname = 'contacts';
--
-- Expect exactly four policies, one per cmd (SELECT/INSERT/UPDATE/DELETE):
--   select policyname, cmd, qual, with_check
--     from pg_policies where tablename = 'contacts' order by cmd;
--
-- Expect no privileges for `anonymous`:
--   select grantee, privilege_type from information_schema.role_table_grants
--    where table_name = 'contacts';
