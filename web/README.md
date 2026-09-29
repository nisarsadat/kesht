# Kesht — Web

A browser build of the **Kesht** (کشت) app: rotating savings groups where each month one
member receives everything the group paid in. It mirrors the mobile app's screens, rules,
theme and Dari/English text, and stores everything in a **Supabase** database so several
people can share one kesht and see the same records.

## What it does

- Create a kesht with a monthly amount and a start month (Hijri-Shamsi calendar).
- Add members while the period is in draft, reorder them, edit or remove them.
- Start the period — one open month with a payment due from every member.
- Track who has paid, choose who receives this month, close the month, and pay out.
- Draw the recipient at random with the spin wheel, or pick someone specific.
- Let a new person join an active kesht (they pay the months already passed).
- Browse the history of closed months.
- Share a kesht with other people (read-only) by email or with a link.
- Switch between Dari (right-to-left) and English, and light/dark themes.

## Signing in and sharing

Each account has its own keshts. You sign in with an email and password.

A kesht can be **shared** from its Overview page (*Share*):

- **The owner** — the account that created it — can do everything, including deciding who
  has access.
- **A manager** runs the kesht day to day: they can change the kesht, its members, months
  and payments, but not who has access.
- **A member** can only look. Every control that changes something is hidden, and the
  database itself rejects their writes.

Two ways to give access:

- **By email** — type someone's address and pick *Member* or *Manager*. Access starts the
  moment they sign up with that address, so no mail server is needed. The owner can switch
  somebody between member and manager at any time.
- **By link** — generate a link that anyone signed in can open to join as a member. Links
  expire after 30 days and can be revoked.

## Set up Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. Open **SQL Editor**, paste all of **`supabase/0001_init.sql`**, and run it. That creates
   the tables, the access rules and the functions the app calls.
3. In **Authentication → Providers**, make sure **Email** is enabled.
   - With **Confirm email** on (the default) people must open a link before first signing
     in. Supabase's built-in mail works for this, with a low hourly limit.
   - Turning it off makes sign-up immediate — fine while you are testing.
4. In **Authentication → URL Configuration** set:
   - **Site URL**: `http://localhost:5173` while developing, your Vercel URL in production.
   - **Redirect URLs**: add `http://localhost:5173/**` and `https://your-app.vercel.app/**`
     (confirmation and password-reset links come back to these).
5. In **Project Settings → API**, copy the **Project URL** and the **anon public** key.

Then point the app at the project:

```bash
cd web
cp .env.example .env.local     # fill in the two values
npm install
npm run dev                    # http://localhost:5173
```

`VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are baked in at build time, so they must be
set wherever you build. The anon key is designed to be public — **row level security** is
what protects the data. Never put the `service_role` key in this app: it bypasses every rule.

## Deploy to Vercel

1. Push this repository to GitHub and import it in Vercel.
2. On the project's settings, set **Root Directory** to `web`. Vercel detects Vite; the
   build command is `npm run build` and the output directory is `dist`.
3. Under **Environment Variables**, add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
   for **Production**, **Preview** and **Development**.
4. Deploy, then add the resulting URL to Supabase's **Site URL** and **Redirect URLs**.
5. Set **Node.js Version** to 20 or newer (a `engines` field already asks for `>= 20`).

`vercel.json` rewrites unknown paths to `index.html`, which is what makes deep links like
`/k/<id>/month` and `/invite/<token>` load instead of 404. Routing uses the browser history
API and Supabase's PKCE auth flow, so those links work with no extra configuration.

Running `npm run build` without credentials is not a silent failure: the site shows a
"Database not connected" notice instead of quietly keeping data in one browser.

## Develop

```bash
npm install
npm run dev        # http://localhost:5173
npm run typecheck  # tsc --noEmit
npm run build      # typecheck, then bundle to dist/
npm run preview    # serve the built dist/ locally
npm run test:sql   # run the schema and access rules against real Postgres
```

**Node 20 or newer is required** (Vite 7).

Without `.env.local`, `npm run dev` still runs the whole app against a local-only store
kept in this browser, which is handy for UI work without a database. A production build
does not do this.

## Checking the access rules

`npm run test:sql` runs `supabase/0001_init.sql` against **real Postgres** (via PGlite,
WebAssembly Postgres — no database server or Docker needed) with Supabase's `auth` schema
and the `anon` / `authenticated` roles shimmed the way Supabase creates them. It then acts
as an owner, a manager, a member and a stranger and checks the rules actually hold:

- a shared member can read a kesht but cannot rename it, delete it, mark payments, add or
  remove members, or push changes through `save_kesht_bundle()`
- a manager can change the kesht, its members and payments, but cannot delete the kesht or
  change who has access
- a stranger sees no rows at all
- email invites grant nothing until claimed, and share links grant member access
- revoked and unknown share links are refused
- a member cannot create share links

Run it after any change to the SQL. It needs no credentials and touches nothing external.

`supabase/verify.sql` is the same checks for the Supabase SQL editor, if you prefer to run
them against your own project. It has three parts:

1. Structure — every table has row level security enabled and the expected policies.
2. Behaviour — a shared member can read a kesht but cannot update, delete or insert into
   it. Paste in two real account ids and run the block; it rolls back at the end.
3. A quick look at what is stored.

Run it any time after `0001_init.sql`.

## Data

| Table | Holds |
|---|---|
| `keshts` | one savings group: name, monthly amount, start month, status, owner |
| `members` | the people in a group, in turn order |
| `rounds` | one month of a group: who receives, open or closed |
| `payments` | what each member owes or paid for one round |
| `kesht_members` | who may see a kesht, and whether they are owner, manager or member |
| `kesht_invites` | share links, with expiry and revocation |

Changing anything rewrites that one kesht and its members, rounds and payments through a
single `save_kesht_bundle()` call, so a change is never half-applied.

## Layout

```
web/
  index.html            page shell (dir=rtl by default)
  vercel.json           SPA rewrite for Vercel
  supabase/
    0001_init.sql       tables, access rules, functions — paste into Supabase
    verify.sql          checks for the access rules
  src/
    main.tsx            React entry
    App.tsx             routes, sign-in guard, theme variables
    styles.css          all styling (CSS variables per theme)
    components/         ui kit, tab bar, prize wheel
    data/               Supabase client, store, row mappers, sharing API
    domain/             kesht rules engine + types (same as mobile)
    i18n/messages.ts    Dari/English text
    lib/                solar calendar, number/money formatting, palettes
    pages/              home, sign in, reset, new kesht, overview, members,
                        month, spin, history, share, invite
    state/app-state.tsx session, roles and live data hooks
```

## Old local data

Earlier versions of this site kept everything in the browser. If it finds keshts saved that
way, the home screen offers to copy them into your account once. Nothing is deleted.
