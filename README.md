# Kesht (کشت)

A rotating-savings app. A *kesht* is a committee: a group pays a fixed amount every month and
each month one member receives the whole pot, until everyone has had a turn.

It ships as two applications that share the same rules and the same screens:

| App | Built with | Storage | Lives in |
|---|---|---|---|
| **Mobile** | Expo / React Native with Expo Router | on-device SQLite (`expo-sqlite`) | repository root — `app/`, `src/` |
| **Web** | Vite + React | **Supabase** (Postgres + Auth) | [`web/`](web/) |

Both speak Dari (right-to-left) and English, with light and dark themes. The web app keeps
everything in Supabase so several people can share one kesht and see the same records — see
[`web/README.md`](web/README.md) for the full picture.

## Run locally

**Web** — http://localhost:5173

```bash
cd web
cp .env.example .env.local     # paste your Supabase project URL and anon key
npm install
npm run dev
```

With no credentials it still runs the whole app against a store kept in the browser, which is
handy for UI work without a database.

**Mobile** — Expo

```bash
npm install
npm start                      # then press i (iOS), a (Android) or w (web)
```

## Tests

```bash
cd web
npm run test:sql               # the schema and access rules, against real Postgres
npm run typecheck
```

`npm run test:sql` needs no database and no credentials. It loads `web/supabase/0001_init.sql`
into Postgres compiled to WebAssembly (PGlite), then checks the row-level security rules really
hold: a shared viewer can read a kesht but cannot change it, a stranger sees nothing, and
revoked share links are refused. It runs on every push via
[`.github/workflows/ci.yml`](.github/workflows/ci.yml).

The kesht rules engine is tested from the mobile side:

```bash
npm run test:rules
```

## Deploy

The web app runs on **Vercel** with **Supabase** as its database.

1. **Supabase** — create a project, paste `web/supabase/0001_init.sql` into the SQL editor and
   run it, enable the **Email** provider, then copy the **Project URL** and the **anon public**
   key from *Project Settings → API*.
2. **Vercel** — import this repository, set **Root Directory** to `web`, and add
   `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as environment variables.
3. Back in **Supabase → Authentication → URL Configuration**, set the **Site URL** to your
   deployed address and add it to **Redirect URLs**, so confirmation and password-reset links
   return to your site.

Only ever put the **anon public** key in the web app. The `service_role` key bypasses every
access rule, and anything Vite bundles is downloadable by every visitor.

## Layout

```
App.tsx, app/, src/        Expo app — screens in app/, storage and rules in src/
  src/db/                  SQLite repository
  src/domain/              kesht rules engine
web/                       Vite web app (see web/README.md)
  supabase/                0001_init.sql — tables, access rules and functions
.github/workflows/ci.yml   typecheck and access-rule tests on every push
```

## Licence

MIT — see [LICENSE](LICENSE).
