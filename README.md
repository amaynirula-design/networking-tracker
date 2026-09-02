# Networking Tracker

A private, per-user networking tracker for the people you want to stay connected with at Berkeley. Sign up, and you get your own contact list — name, company, role, where you met, notes, and a high/medium/low priority — that you can search, filter, sort, edit, and delete. Every contact belongs to exactly one account, and that ownership is enforced by Postgres Row Level Security rather than by application code, so a signed-in user physically cannot read or modify anyone else's rows even if they bypass the browser entirely and call the API directly.

**Live app:** <https://networking-tracker-nine.vercel.app>

---

## Table of contents

- [Features](#features)
- [Product walkthrough](#product-walkthrough)
- [Technology stack](#technology-stack)
- [Architecture](#architecture)
- [Database schema](#database-schema)
- [Authentication and RLS ownership](#authentication-and-rls-ownership)
- [Local setup](#local-setup)
- [Environment variables](#environment-variables)
- [Testing](#testing)
- [Deployment](#deployment)
- [Grading evidence](#grading-evidence)
- [Known limitations](#known-limitations-and-what-id-do-next)

---

## Features

- **Email + password accounts** via Neon Managed Better Auth — sign up, sign in, sign out.
- **Private contact list** — every user sees only their own contacts.
- **Full CRUD** — add, view, edit, and delete contacts, with a confirmation step before deleting.
- **Dates that matter** — record when you met someone and when to follow up.
- **Follow-up reminders** — a banner surfaces everything due today or overdue, with a one-click "Follow-ups due" filter, and an optional browser notification (see [limitations](#known-limitations-and-what-id-do-next) for what that does and doesn't cover).
- **Search** across name, company, role, and where you met, debounced and executed in Postgres.
- **Filter** by priority; **sort** by name, company, priority, or date added, ascending or descending.
- **Priority sorts by urgency, not alphabet** — a generated `priority_rank` column means "high" sorts above "medium" above "low" instead of the meaningless alphabetical high/low/medium.
- **Persistent** — data lives in Neon Postgres and survives refreshes, new tabs, and new devices.
- **Understandable states** — distinct loading, empty, "no results for these filters", success, and error states.
- **Responsive** — a real table on desktop, stacked cards on mobile.
- **Validated twice** — instant inline errors in the browser, and authoritative CHECK constraints in the database.

## Product walkthrough

Every behaviour below was exercised against the running app and the live Neon
database, and the observed result is recorded. (Screenshots to be dropped into
`docs/screenshots/` — see [Adding screenshots](#adding-screenshots).)

| Step | What was verified | Result |
|---|---|---|
| Sign in | Wrong credentials on a real account | Inline error, "Invalid email or password", nothing submitted |
| Sign in | Valid credentials | Lands on `/contacts`, header shows the signed-in email |
| Empty state | New account with no rows | "No contacts yet" + "Add your first contact" call to action |
| Validation | Submit the form with a blank name | Inline "Name is required.", `aria-invalid="true"`, `aria-describedby` wired to the message, dialog stays open, **no request sent** |
| Create | Full contact with company, role, where-met, notes, priority High | Row appears, count goes to 1 |
| Create | Contact with a name only | Saves; optional fields stored as `NULL` and the company/role line is omitted rather than rendering an empty separator |
| Persist | Full page reload | All rows return from Postgres — nothing is client-side state |
| Search | `stripe` | Case-insensitive match on the company column |
| Search | `mixer, Chou` (contains a comma) | Correctly returns the one match. Unescaped this is a `PGRST100` 400 — see [filter escaping](#testing) |
| Search | `zzz-no-such-person` | "No contacts match those filters" — distinct from the no-contacts empty state |
| Sort | Priority, ascending | High → Medium → Low, via the generated `priority_rank` column. Alphabetical would wrongly give High → Low → Medium |
| Sort | Name, ascending | Aiko, Daniel, Marcus, Priya |
| Filter | Priority = High | Only the two High contacts |
| Edit | Open an existing row | Dialog pre-filled with that row's values; changes persist |
| Delete | Cancel the confirmation | Row count unchanged |
| Delete | Confirm | Row removed, count decremented |
| Responsive | 1280px | Six-column table; card list hidden; no horizontal page scroll |
| Responsive | 375px | Stacked cards; table hidden (`display: none`); no horizontal overflow |
| Sign out | Sign out button | Session cleared, redirected to `/sign-in` |
| Route guard | Visit `/contacts` while signed out | Redirected to `/sign-in`; no contact data rendered |

### Adding screenshots

The `docs/screenshots/` directory is ready. The rubric asks for captures of
sign-in/sign-out, create/edit/delete/refresh, a two-account privacy check, and
one invalid input failing safely. Save them with these names and they will
appear here:

`01-sign-in.png`, `02-empty-state.png`, `03-contact-list.png`,
`04-add-contact.png`, `05-validation-error.png`, `06-filter-sort.png`,
`07-mobile.png`, `08-two-accounts.png`

The two-account requirement is additionally covered by an automated test — see
[Testing](#testing).

## Technology stack

| Layer | Choice | Why |
|---|---|---|
| Framework | **Next.js 16** (App Router, TypeScript) | Deploys to Vercel with no configuration, and the App Router keeps routing and layout conventions simple. Every page here is a static shell that fetches its data client-side. |
| Styling | **Tailwind CSS v4 + shadcn/ui** | shadcn/ui gives accessible, unstyled-by-default primitives (dialog, select, table, alert dialog) that I own in-repo rather than a black-box dependency. Satisfies the "design or component system" requirement and made the responsive pass straightforward. |
| Auth | **Neon Managed Better Auth** | Managed, and it stores identity in the same Postgres database as the data, so `auth.user_id()` is available directly inside RLS policies with no token plumbing of my own. |
| Data access | **Neon Data API** via `@neondatabase/neon-js` | A PostgREST interface over Postgres. The SDK attaches the signed-in user's JWT to every request automatically, which is what makes RLS work end to end. |
| Database | **Neon Postgres** | Serverless Postgres with branching. RLS is the security boundary of this app. |
| Validation | **Zod** in the browser, **CHECK constraints** in Postgres | Zod for a fast, clear error message; constraints because they cannot be bypassed. |
| Tests | **Vitest** | Fast, no config beyond a path alias, and `describe.skipIf` cleanly separates unit tests from the credentialed integration suite. |
| Hosting | **Vercel** | First-class Next.js support and instant preview deploys. |

## Architecture

```
┌──────────────────────────────────────────────┐
│  Browser — Next.js (static shell + React)    │
│                                              │
│  components/         presentation only       │
│        │                                     │
│  lib/contacts/schema.ts   Zod validation ────┼── shared, framework-free,
│  lib/contacts/query.ts    sort/filter logic  │   unit-tested in isolation
│        │                                     │
│  lib/contacts/api.ts      CRUD calls         │
│        │                                     │
│  lib/neon.ts   createClient({ auth, dataApi })│
└────────┼─────────────────────────────────────┘
         │  HTTPS, Authorization: Bearer <JWT>
         ▼
┌──────────────────────────────────────────────┐
│  Neon Managed Better Auth   →  issues the JWT│
│  Neon Data API (PostgREST)  →  validates it  │
└────────┼─────────────────────────────────────┘
         │  SET ROLE authenticated; auth.user_id() = JWT `sub`
         ▼
┌──────────────────────────────────────────────┐
│  Neon Postgres — THE TRUSTED BACKEND         │
│                                              │
│  • RLS policies decide which rows you see    │
│  • CHECK constraints decide what is valid    │
│  • user_id DEFAULT auth.user_id() sets owner │
└──────────────────────────────────────────────┘
```

### Where the frontend ends and the backend begins

The browser talks to the Neon Data API directly, so **nothing enforced in React can be trusted**. Anyone can open the devtools, read the two public URLs, and issue their own requests with their own JWT. The app is designed around that fact:

- **Frontend** (`src/app`, `src/components`) is presentation and interaction only. It renders state and collects input.
- **Domain layer** (`src/lib/contacts/schema.ts`, `src/lib/contacts/query.ts`) is pure TypeScript — it imports neither React nor the Neon SDK. It defines what a valid contact is and how sorting and filtering are expressed. Because it is decoupled, it is unit-tested directly with no mocks, no DOM, and no network.
- **Backend** is Postgres. Ownership (`user_id DEFAULT auth.user_id()`, four RLS policies) and validity (CHECK constraints) are enforced there. The Zod schema in the domain layer is a *mirror* of those constraints for fast feedback, not a substitute for them.

The integration test proves this split is real: it bypasses the app's Zod schema entirely, posts an invalid priority straight to the Data API, and the database rejects it.

### Request flow for "add a contact"

1. User submits the dialog. `parseContactInput` validates locally; if it fails, inline errors render and nothing is sent.
2. `createContact` posts to the Data API. **`user_id` is deliberately not included in the payload.**
3. The SDK attaches the user's JWT. The Data API verifies its signature against Neon's JWKS and assumes the `authenticated` Postgres role.
4. Postgres fills `user_id` from `DEFAULT auth.user_id()` — the JWT's `sub` claim. The client cannot choose an owner.
5. The `contacts_insert_own` policy's `WITH CHECK` confirms `auth.user_id() = user_id`, and the CHECK constraints confirm the values are valid.
6. The row is returned and the list refreshes.

## Database schema

Full DDL, including policies and grants: [`db/schema.sql`](db/schema.sql).

### `public.contacts`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `uuid` | PK, `default gen_random_uuid()` | Surrogate key. |
| `user_id` | `text` | **`not null`**, **`default auth.user_id()`** | The owner. Comes from the JWT `sub` claim, never from the client. `NOT NULL` means an unauthenticated caller cannot insert at all, because `auth.user_id()` is `NULL` for them. |
| `name` | `text` | `not null`, non-blank, ≤ 120 chars | The only required user-supplied field. |
| `company` | `text` | nullable, ≤ 120 chars | |
| `role` | `text` | nullable, ≤ 120 chars | |
| `met_at` | `text` | nullable, ≤ 160 chars | Where you met them, free text. |
| `met_on` | `date` | nullable, 1900–2100 | The day you met. A `date`, not a `timestamptz` — a calendar day has no time zone, and storing an instant would shift the day for a travelling user. |
| `follow_up_on` | `date` | nullable, 1900–2100 | When to get back in touch. Drives the reminder banner and the "due" filter. |
| `notes` | `text` | nullable, ≤ 2000 chars | |
| `priority` | `text` | `not null`, `default 'medium'`, **`check (priority in ('high','medium','low'))`** | Only these three values are accepted, at the database level. |
| `priority_rank` | `int` | `generated always as (…) stored` | 1/2/3 for high/medium/low, so the database can sort by urgency. |
| `created_at` | `timestamptz` | `not null`, `default now()` | |
| `updated_at` | `timestamptz` | `not null`, `default now()` | Maintained by the `contacts_set_updated_at` trigger. |

Named constraints: `contacts_name_not_blank`, `contacts_name_len`, `contacts_company_len`, `contacts_role_len`, `contacts_met_at_len`, `contacts_notes_len`, `contacts_priority_valid`, `contacts_user_not_blank`, `contacts_met_on_range`, `contacts_follow_up_on_range`.

Indexes: `contacts_user_id_idx (user_id)`, `contacts_user_created_idx (user_id, created_at desc)`, and a **partial** index `contacts_follow_up_idx (user_id, follow_up_on) where follow_up_on is not null` — the "what do I owe today" query only ever touches rows that have a follow-up date, which is a small slice of the table. Every query is scoped to one user by RLS, so these are the access paths that matter.

## Authentication and RLS ownership

Neon Managed Better Auth issues a JWT whose `sub` claim is the user's id. The Data API validates that signature and exposes the claim to Postgres as **`auth.user_id()`**, which returns the `sub` as `text`. That single function is the entire ownership rule.

RLS is enabled *and* forced on the table:

```sql
alter table public.contacts enable row level security;
alter table public.contacts force  row level security;
```

Four separate policies, one per operation, each scoped to `authenticated`:

```sql
create policy contacts_select_own on public.contacts
  for select to authenticated using (auth.user_id() = user_id);

create policy contacts_insert_own on public.contacts
  for insert to authenticated with check (auth.user_id() = user_id);

create policy contacts_update_own on public.contacts
  for update to authenticated
  using      (auth.user_id() = user_id)   -- which rows you may edit
  with check (auth.user_id() = user_id);  -- what they may become

create policy contacts_delete_own on public.contacts
  for delete to authenticated using (auth.user_id() = user_id);
```

**`USING` vs `WITH CHECK` is the important distinction.** `USING` filters which existing rows an operation can even see — this is why another user's rows are invisible to `SELECT` and simply don't match an `UPDATE` or `DELETE`. `WITH CHECK` validates the row *after* the write — this is what stops you rewriting your own row so that it belongs to somebody else. Without it, `update contacts set user_id = '<someone else>'` would succeed. Both clauses are present on `UPDATE` for exactly that reason, and the integration test asserts the transfer attempt fails with Postgres error `42501`.

Grants go to `authenticated` only:

```sql
grant usage on schema public to authenticated;
grant select, insert, update, delete on public.contacts to authenticated;
revoke all on public.contacts from anonymous;   -- signed-out visitors get nothing
```

The two `NEXT_PUBLIC_` URLs are public by design — they ship in the JavaScript bundle. **Security does not come from hiding them; it comes from RLS.** There is no Postgres connection string anywhere in the frontend, and the app does not need one at runtime.

To show that concretely, here is the deployed Data API answering a request that carries a valid **anonymous** token — a token anyone can mint from the public auth endpoint — asking for the contacts table:

```console
$ curl -s "$DATA_API_URL/contacts?select=id" -H "Authorization: Bearer $ANON_TOKEN"
{"code":"42501","message":"permission denied for table contacts","details":null,"hint":null}
```

A request with no token at all is refused earlier still:

```console
$ curl -s "$DATA_API_URL/contacts"
{"message":"missing authentication credentials: required authorization bearer token in JWT format", ...}
```

## Local setup

### Prerequisites

Node.js 20+ and a free [Neon](https://neon.com) account.

### 1. Clone and install

```bash
git clone https://github.com/amaynirula-design/networking-tracker.git
cd networking-tracker
npm install
```

### 2. Create the Neon project

1. In the **Neon Console**, create a project. **Choose an AWS region** — Managed Better Auth is not available on Azure.
2. Go to your branch → **Auth** → enable **Managed Better Auth**. Copy the **Auth URL** (looks like `https://ep-xxx.<region>.aws.neon.tech/neondb/auth`).
3. Go to **Database → Data API**. Set the auth provider to **Managed Better Auth**, tick **Grant public schema access**, and click **Enable Data API**. Copy the **Data API URL** (looks like `https://ep-xxx.<region>.aws.neon.tech/neondb/rest/v1`).

> Enable the Data API *before* running the SQL — enabling it is what creates the `authenticated` role that the policies and grants reference.

### 3. Create the schema

Open the **SQL Editor** in the Neon Console, paste the contents of [`db/schema.sql`](db/schema.sql), and run it. It is safe to re-run.

Verify it took effect:

```sql
select relrowsecurity, relforcerowsecurity from pg_class where relname = 'contacts';
select policyname, cmd from pg_policies where tablename = 'contacts' order by cmd;
```

You should see row security enabled and exactly four policies, one each for `SELECT`, `INSERT`, `UPDATE`, and `DELETE`.

### 4. Configure the environment

```bash
cp .env.example .env.local
```

Fill in the two URLs from step 2. `.env.local` is gitignored.

### 5. Run

```bash
npm run dev
```

Open <http://localhost:3000>, create an account, and add a contact.

## Environment variables

See [`.env.example`](.env.example) for the committed template — placeholder values only.

| Variable | Scope | Required | Purpose |
|---|---|---|---|
| `NEXT_PUBLIC_NEON_AUTH_URL` | Public | Yes | Managed Better Auth endpoint. Ships to the browser by design. |
| `NEXT_PUBLIC_NEON_DATA_API_URL` | Public | Yes | Neon Data API endpoint. Ships to the browser by design; protected by RLS. |
| `DATABASE_URL` | **Server-only** | No | Postgres connection string. Not used at runtime — the app reaches the database through the Data API. Never prefix with `NEXT_PUBLIC_`. |
| `NEON_AUTH_BASE_URL` | **Server-only** | No | Only needed if you add server-side Better Auth routes. This build does not. |
| `NEON_AUTH_COOKIE_SECRET` | **Server-only** | No | As above. Generate with `openssl rand -base64 32`. |
| `TEST_USER_A_EMAIL` / `TEST_USER_A_PASSWORD` | **Server-only** | No | Credentials for the two-account RLS test. |
| `TEST_USER_B_EMAIL` / `TEST_USER_B_PASSWORD` | **Server-only** | No | As above. |

No secret value is committed anywhere in this repository or its history.

## Testing

```bash
npm test          # unit tests — no network, no credentials needed
npm run test:rls  # two-account RLS test — needs a live Neon project
```

### `npm test` — 35 unit tests, always runnable

Pure tests over the domain layer. A grader can clone the repo, `npm install`, and run these immediately.

**`tests/schema.test.ts`** — validation. Asserts that an empty name, a whitespace-only name, a missing name, and an over-length name are all rejected with a clear message; that all three valid priorities are accepted; that invalid priorities (`urgent`, `HIGH`, `'medium '`, `''`, `null`, `undefined`, `1`) are rejected and never silently coerced to a default; that blank optional fields are stored as `NULL` rather than `''`; and that multiple invalid fields are all reported at once.

**`tests/followup.test.ts`** — dates and follow-up logic. Asserts that blank dates become `NULL`; that malformed inputs (`14/08/2026`, `2026-8-14`, `tomorrow`) are rejected; and — the one that actually caught a bug — that an **impossible calendar date like `2026-02-30` is rejected**. JavaScript does not throw on that; `new Date('2026-02-30')` silently rolls over to 2 March, so the first implementation accepted it. The validator now round-trips the parsed date and compares. Also covers the overdue/today/soon/later buckets, the human labels ("5 days overdue", "Due tomorrow"), and that "today" is computed from the **local** calendar day rather than `toISOString()`, which would report tomorrow's date for anyone east of Greenwich in the evening.

**`tests/query.test.ts`** — sorting and filtering. Asserts that unknown sort fields and priorities are ignored rather than trusted; that `priority` maps to the generated `priority_rank` column so ordering is by urgency; and that search terms are escaped for the PostgREST filter grammar — a crafted term like `x,user_id.neq.zzz` stays inside one quoted clause instead of injecting a second condition.

### `npm run test:rls` — the two-account privacy proof

Skipped automatically unless credentials are present, so `npm test` stays green in a fresh clone. To run it, create two accounts through the app's own sign-up page and add their credentials to `.env.local`.

It signs both users in over HTTPS, exchanges each session for a real JWT, and drives the **live Data API** — the same endpoint the browser uses. It asserts that:

1. `user_id` is populated from `auth.user_id()`, not from the client.
2. An **unfiltered** `select *` as User B does not return User A's row. (No `.eq()` — RLS alone does the filtering.)
3. Asking for A's row by id as B returns nothing.
4. B's `UPDATE` of A's row changes zero rows, and A's data is unchanged afterwards.
5. B's `DELETE` of A's row removes nothing, and the row still exists.
6. B inserting a row with `user_id` set to A's id is **rejected** with Postgres `42501` — the `INSERT` policy's `WITH CHECK`.
7. B rewriting their *own* row's `user_id` to A's id is **rejected** with `42501` — the `UPDATE` policy's `WITH CHECK`.
8. An invalid priority sent **straight to the Data API, bypassing Zod entirely**, is rejected by the database with `23514` on `contacts_priority_valid`.
9. A blank name, likewise bypassing the client, is rejected with `23514` on `contacts_name_not_blank`.
10. A request with no token cannot read contacts.

Items 6–9 are the ones worth reading closely: they prove that the security and validation guarantees hold against a client that ignores the app's own code.

### Test output

```text
$ npm test          # unit only in a fresh clone
$ npm run test:rls   # adds the live two-account suite

 ✓ tests/query.test.ts > buildContactQuery — defaults > falls back to newest-first when given nothing 5ms
 ✓ tests/query.test.ts > buildContactQuery — defaults > ignores an unknown sort field instead of trusting it 0ms
 ✓ tests/query.test.ts > buildContactQuery — defaults > ignores an unknown priority filter 0ms
 ✓ tests/query.test.ts > buildContactQuery — defaults > treats any direction other than asc as desc 0ms
 ✓ tests/query.test.ts > buildContactQuery — sorting > maps priority onto the generated rank column, not the text column 0ms
 ✓ tests/query.test.ts > buildContactQuery — sorting > passes through plain columns unchanged 0ms
 ✓ tests/query.test.ts > buildContactQuery — search > produces no filter for a blank search 1ms
 ✓ tests/query.test.ts > buildContactQuery — search > searches name, company, role and met_at with wildcards 1ms
 ✓ tests/query.test.ts > buildContactQuery — search > trims the search term 0ms
 ✓ tests/query.test.ts > escapeFilterValue — PostgREST grammar safety > quotes commas so they cannot split a filter into extra clauses 0ms
 ✓ tests/query.test.ts > escapeFilterValue — PostgREST grammar safety > escapes embedded double quotes and backslashes 0ms
 ✓ tests/query.test.ts > escapeFilterValue — PostgREST grammar safety > keeps a crafted term inside a single clause 1ms
 ✓ tests/query.test.ts > isFiltered > is false for the default view 0ms
 ✓ tests/query.test.ts > isFiltered > is true once a search or priority filter is applied 0ms
 ✓ tests/query.test.ts > buildContactQuery — date sorting > accepts the date columns as sort fields 0ms
 ✓ tests/query.test.ts > buildContactQuery — date sorting > keeps empty dates at the bottom in both directions 0ms
 ✓ tests/query.test.ts > buildContactQuery — date sorting > leaves never-null columns to the database default ordering 0ms
 ✓ tests/query.test.ts > buildContactQuery — due follow-ups > is inactive by default 0ms
 ✓ tests/query.test.ts > buildContactQuery — due follow-ups > filters to follow-ups on or before today 0ms
 ✓ tests/query.test.ts > buildContactQuery — due follow-ups > ignores the flag when no date is supplied, rather than guessing one 0ms
 ✓ tests/query.test.ts > buildContactQuery — due follow-ups > counts as a filter for the empty-state copy 0ms
 ✓ tests/schema.test.ts > parseContactInput — required fields > accepts a fully populated contact 12ms
 ✓ tests/schema.test.ts > parseContactInput — required fields > rejects an empty name with a clear message 2ms
 ✓ tests/schema.test.ts > parseContactInput — required fields > rejects a whitespace-only name 1ms
 ✓ tests/schema.test.ts > parseContactInput — required fields > rejects a missing name 1ms
 ✓ tests/schema.test.ts > parseContactInput — required fields > trims surrounding whitespace from the name 2ms
 ✓ tests/schema.test.ts > parseContactInput — required fields > rejects a name longer than the column limit 2ms
 ✓ tests/schema.test.ts > parseContactInput — priority > accepts the valid priority high 1ms
 ✓ tests/schema.test.ts > parseContactInput — priority > accepts the valid priority medium 0ms
 ✓ tests/schema.test.ts > parseContactInput — priority > accepts the valid priority low 0ms
 ✓ tests/schema.test.ts > parseContactInput — priority > rejects the invalid priority urgent 1ms
 ✓ tests/schema.test.ts > parseContactInput — priority > rejects the invalid priority HIGH 0ms
 ✓ tests/schema.test.ts > parseContactInput — priority > rejects the invalid priority High 0ms
 ✓ tests/schema.test.ts > parseContactInput — priority > rejects the invalid priority  0ms
 ✓ tests/schema.test.ts > parseContactInput — priority > rejects the invalid priority null 0ms
 ✓ tests/schema.test.ts > parseContactInput — priority > rejects the invalid priority undefined 0ms
 ✓ tests/schema.test.ts > parseContactInput — priority > rejects the invalid priority 1 0ms
 ✓ tests/schema.test.ts > parseContactInput — priority > rejects the invalid priority medium  0ms
 ✓ tests/schema.test.ts > parseContactInput — priority > does not silently coerce an unknown priority to a default 0ms
 ✓ tests/schema.test.ts > parseContactInput — optional fields > stores blank optional fields as null rather than empty strings 0ms
 ✓ tests/schema.test.ts > parseContactInput — optional fields > reports every invalid field at once 1ms
 ✓ tests/schema.test.ts > isPriority > narrows only the three accepted values 0ms
 ✓ tests/followup.test.ts > date validation > accepts a valid ISO date 11ms
 ✓ tests/followup.test.ts > date validation > treats a blank date as not provided rather than an error 0ms
 ✓ tests/followup.test.ts > date validation > rejects an impossible calendar date that still matches the pattern 1ms
 ✓ tests/followup.test.ts > date validation > rejects the malformed date 14/08/2026 0ms
 ✓ tests/followup.test.ts > date validation > rejects the malformed date 2026-8-14 0ms
 ✓ tests/followup.test.ts > date validation > rejects the malformed date August 14 0ms
 ✓ tests/followup.test.ts > date validation > rejects the malformed date 20260814 0ms
 ✓ tests/followup.test.ts > date validation > rejects the malformed date tomorrow 0ms
 ✓ tests/followup.test.ts > date validation > rejects dates outside the range the database will accept 0ms
 ✓ tests/followup.test.ts > daysUntil > counts forward and backward from today 0ms
 ✓ tests/followup.test.ts > daysUntil > crosses month and year boundaries correctly 0ms
 ✓ tests/followup.test.ts > followUpStatus > buckets by distance from today 0ms
 ✓ tests/followup.test.ts > followUpStatus > reports none for a missing date 0ms
 ✓ tests/followup.test.ts > isFollowUpDue > is true only for today and the past 0ms
 ✓ tests/followup.test.ts > followUpLabel > reads naturally at the boundaries 1ms
 ✓ tests/followup.test.ts > todayIso > uses the local calendar day, not UTC 0ms
 ✓ tests/followup.test.ts > todayIso > does not roll over the date late in the evening 0ms
 ✓ tests/rls.integration.test.ts > RLS — User A vs User B > defaults user_id to the caller's own auth.user_id() 45ms
 ✓ tests/rls.integration.test.ts > RLS — User A vs User B > does not leak the row into an unfiltered list for the other user 41ms
 ✓ tests/rls.integration.test.ts > RLS — User A vs User B > returns nothing when the other user asks for the row by id 43ms
 ✓ tests/rls.integration.test.ts > RLS — User A vs User B > refuses to update another user's row 82ms
 ✓ tests/rls.integration.test.ts > RLS — User A vs User B > refuses to delete another user's row 84ms
 ✓ tests/rls.integration.test.ts > RLS — User A vs User B > refuses an insert that claims another user as the owner 41ms
 ✓ tests/rls.integration.test.ts > RLS — User A vs User B > refuses to hand your own row to someone else 178ms
 ✓ tests/rls.integration.test.ts > Database-level validation > rejects an invalid priority even when the client is bypassed 49ms
 ✓ tests/rls.integration.test.ts > Database-level validation > rejects a blank name even when the client is bypassed 40ms
 ✓ tests/rls.integration.test.ts > Anonymous access > refuses to read contacts without a token 6ms
 Test Files  4 passed (4)
      Tests  69 passed (69)
```

## Deployment

1. **Push to GitHub.** Already done — the repository lives at
   <https://github.com/amaynirula-design/networking-tracker>.

   ```bash
   git push origin main
   ```

2. **Import into Vercel** — New Project → import the repo. Framework preset is detected as Next.js; no build settings need changing.

3. **Add the environment variables** in Vercel → Settings → Environment Variables, for Production (and Preview if you want previews to work):

   - `NEXT_PUBLIC_NEON_AUTH_URL`
   - `NEXT_PUBLIC_NEON_DATA_API_URL`

   Do **not** add `DATABASE_URL`; the app does not use it at runtime.

4. **Add the Vercel domain to Neon Auth's trusted origins.** In the Neon Console → Auth → trusted origins, add `https://<your-app>.vercel.app`. **Sign-in will fail without this step**, and the failure is easy to misread as a credentials problem.

5. **Redeploy** so the environment variables are baked into the client bundle. `NEXT_PUBLIC_*` values are inlined at build time, so adding them after a build has no effect until you rebuild.

6. **Verify in a private window** — sign up, add a contact, refresh, edit, delete, sign out. Then repeat the two-account privacy test against the live URL.

## Grading evidence

| Requirement | Where to find it |
|---|---|
| Live public URL | <https://networking-tracker-nine.vercel.app> |
| Sign in / sign out | [Product walkthrough](#product-walkthrough) — verified; screenshot slot `01-sign-in.png` |
| Create, edit, delete, refresh | [Product walkthrough](#product-walkthrough) — all verified against live Postgres |
| Two accounts, no cross-access | `npm run test:rls` — 10 assertions, output in [Testing](#testing) |
| Invalid input fails safely | [Product walkthrough](#product-walkthrough) — client inline error **and** DB `23514` when the client is bypassed |
| Automated test passing | [Test output](#test-output) above |
| `user_id text default auth.user_id()`, not null | [`db/schema.sql`](db/schema.sql), [schema table](#database-schema) |
| RLS enabled | [`db/schema.sql`](db/schema.sql) |
| Four separate policies | [Auth and RLS](#authentication-and-rls-ownership) |
| Update cannot reassign ownership | `WITH CHECK` on `contacts_update_own`; test #7 |
| No committed secrets | `.gitignore` excludes `.env*` but permits `.env.example`; no secret in history |

## Known limitations and what I'd do next

- **Follow-up notifications only fire while the app is open.** The banner and the "due" filter are reliable — they are rendered from the data on every load. The *browser notification* on top of them is best-effort: this is a static front end with no server process and no service worker, so nothing can wake the browser when the tab is closed. Real push would need a scheduled job server-side (a Vercel cron reading `follow_up_on` and sending via the Web Push API with VAPID keys, or an email digest). That is the honest next step, and it is the main thing I would build next.
- **No recurring follow-ups.** A follow-up date is a single point, not a cadence; completing one does not schedule the next.
- **No pagination.** Every contact is fetched in one request. Fine for a personal list of tens or hundreds; at thousands it would need `.range()` and infinite scroll. The index on `(user_id, created_at desc)` is already there to support it.
- **No optimistic updates.** Every mutation waits for a round trip and then refetches. Simple and always consistent, but it feels slower than it needs to. A library like TanStack Query would fix this and add caching.
- **Email/password only.** Managed Better Auth also supports OAuth; adding Google sign-in would be a small change to the auth form.
- **No password reset flow.** A user who forgets their password currently has no path to recovery.
- **Search is `ILIKE`-based**, so it matches substrings but not typos or word stems. Postgres full-text search or a trigram index would be the next step.
- **The RLS test needs two pre-created accounts** rather than provisioning and tearing them down itself. Programmatic sign-up would make it fully self-contained and CI-runnable.
- **No rate limiting** on the Data API beyond what Neon provides. A determined authenticated user could hammer their own endpoints.
- **Accessibility**: colour contrast was measured in the browser rather than eyeballed — every text/background pair in the contact list, badges, stat tiles and banners clears WCAG AA in both light and dark themes (the priority and follow-up badges initially failed at 3.67:1 and were darkened until they passed). Labels, `aria-invalid`, `aria-describedby`, `role="alert"` and keyboard-reachable row actions are all in place, and all motion is disabled under `prefers-reduced-motion`. It has not had a full screen-reader audit.
