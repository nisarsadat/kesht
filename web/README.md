# Kesht — Web

A browser build of the **Kesht** (کشت) app: rotating savings groups where each month one
member receives everything the group paid in. It mirrors the mobile app's screens, rules,
theme and Dari/English text, and stores everything in a **Neon** Postgres database so
several people can share one kesht and see the same records.

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

## Set up Neon

1. Create a project at [neon.tech](https://neon.tech).
2. Pick the branch you want to use. If it says **archived**, click it to unarchive.
3. Open the **Data API** tab and enable it:
   - Check **Use Managed Better Auth**.
   - Check **Grant public schema access**.
   - Copy the **Data API URL** (ends in `/rest/v1`).
4. Open the **Auth** tab and enable **Managed Better Auth**.
   - Copy the **Auth base URL** (ends in `/auth`).
   - Under **Email / Password**, turn off **Require email verification** while testing
     (otherwise the app cannot sign anyone in until emails are configured).
5. Open the **SQL Editor** and run the whole **`neon/0001_init.sql`** file. That creates
   the tables, row level security policies and the functions the app calls.

Then point the app at the project:

```bash
cd web
cp .env.example .env.local     # paste Data API URL + server auth vars
npm install
npm run dev                    # http://localhost:5173
```

Auth requests go through the same-origin `/api/auth` proxy (needed for Safari/iPhone). The
browser only needs `VITE_NEON_DATA_API_URL` (baked in at build time). The proxy needs
`NEON_AUTH_BASE_URL` and `NEON_AUTH_COOKIE_SECRET` at runtime. The Data API is protected by
**row level security** and the signed-in user's JWT.

## Deploy to Vercel

1. Push this repository to GitHub and import it in Vercel.
2. On the project's settings, set **Root Directory** to `web`. Vercel detects Vite; the
   build command is `npm run build` and the output directory is `dist`.
3. Under **Environment Variables**, add for **Production**, **Preview** and **Development**:
   - `VITE_NEON_DATA_API_URL` — Neon Data API URL (client, build-time)
   - `NEON_AUTH_BASE_URL` — Neon Auth base URL (server, for `/api/auth` proxy)
   - `NEON_AUTH_COOKIE_SECRET` — random secret, at least 32 characters (server; e.g.
     `openssl rand -base64 32`)
4. In Neon's Auth settings, add your deployed URL to the allowed redirect/callback URLs.
5. Set **Node.js Version** to 20 or newer (a `engines` field already asks for `>= 20`).

`vercel.json` rewrites unknown paths to `index.html`, which is what makes deep links like
`/k/<id>/month` and `/invite/<token>` load instead of 404. Routing uses the browser history
API and Neon's managed auth flow.

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

`npm run test:sql` runs `neon/0001_init.sql` against **real Postgres** (via PGlite,
WebAssembly Postgres — no database server or Docker needed) with Neon's Data API roles
and the `authenticated` / `anonymous` roles shimmed the way Neon's Data API uses them. It then acts
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

`neon/verify.sql` is the same checks for the Neon SQL editor, if you prefer to run
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
  neon/
    0001_init.sql       tables, access rules, functions — paste into Neon
    verify.sql          checks for the access rules
  src/
    main.tsx            React entry
    App.tsx             routes, sign-in guard, theme variables
    styles.css          all styling (CSS variables per theme)
    components/         ui kit, tab bar, prize wheel
    data/               Neon client, store, row mappers, sharing API
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
