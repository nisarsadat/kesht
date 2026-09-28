/**
 * Runs supabase/0001_init.sql against a real Postgres engine and checks that the
 * access rules actually do what they claim.
 *
 * PGlite is Postgres compiled to WebAssembly, so this needs no database server.
 * Supabase's own `auth` schema is shimmed with the same functions it provides
 * (auth.uid() / auth.jwt() reading request.jwt.claims), and the `anon` and
 * `authenticated` roles are created the way Supabase creates them: plain roles
 * with no special privileges, so row level security genuinely applies.
 *
 *   npm run test:sql
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';

const here = dirname(fileURLToPath(import.meta.url));
const migration = readFileSync(join(here, '..', 'supabase', '0001_init.sql'), 'utf8');

const OWNER = { sub: '11111111-1111-4111-8111-111111111111', email: 'owner@example.com' };
const VIEWER = { sub: '22222222-2222-4222-8222-222222222222', email: 'viewer@example.com' };
const STRANGER = { sub: '33333333-3333-4333-8333-333333333333', email: 'stranger@example.com' };

const failures = [];
let checks = 0;

function check(label, actual, expected) {
  checks += 1;
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures.push(`${label}\n     expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${label}${ok ? '' : ` (expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)})`}`);
}

/** Runs as a given user, the way a signed-in browser request would. */
async function as(db, user, sql, params = []) {
  await db.query('select set_config($1, $2, false)', ['request.jwt.claims', JSON.stringify(user)]);
  await db.exec('set role authenticated');
  try {
    return await db.query(sql, params);
  } finally {
    await db.exec('reset role');
  }
}

async function asExpectFailure(db, user, label, sql) {
  checks += 1;
  await db.query('select set_config($1, $2, false)', ['request.jwt.claims', JSON.stringify(user)]);
  await db.exec('set role authenticated');
  try {
    await db.query(sql);
    failures.push(`${label} — expected the database to refuse this, but it succeeded`);
    console.log(`  FAIL ${label} (the database allowed it)`);
  } catch {
    console.log(`  ok   ${label}`);
  } finally {
    await db.exec('reset role');
  }
}

const db = new PGlite();
await db.waitReady;

// ---------------------------------------------------------------------------
// Supabase's environment, reproduced.
// ---------------------------------------------------------------------------

await db.exec(`
  create role anon nologin;
  create role authenticated nologin;

  create schema auth;
  create table auth.users (
    id uuid primary key,
    email text unique
  );
  create or replace function auth.jwt() returns jsonb
    language sql stable as $$
      select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb;
    $$;
  create or replace function auth.uid() returns uuid
    language sql stable as $$
      select nullif(auth.jwt() ->> 'sub', '')::uuid;
    $$;
  grant usage on schema auth to anon, authenticated;
  grant execute on function auth.jwt(), auth.uid() to anon, authenticated;

  insert into auth.users (id, email) values
    ('${OWNER.sub}', '${OWNER.email}'),
    ('${VIEWER.sub}', '${VIEWER.email}'),
    ('${STRANGER.sub}', '${STRANGER.email}');
`);

console.log('\nApplying supabase/0001_init.sql …');
await db.exec(migration);
console.log('  ok   migration applied\n');

// ---------------------------------------------------------------------------
// Structure
// ---------------------------------------------------------------------------

console.log('Structure');

const rlsOn = await db.query(`
  select c.relname as name, c.relrowsecurity as enabled
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r'
     and c.relname in ('keshts','members','rounds','payments','kesht_members','kesht_invites')
   order by c.relname
`);
check('all six tables have row level security enabled', rlsOn.rows.map((r) => r.enabled), [true, true, true, true, true, true]);

const policyCount = await db.query(`
  select count(*)::int as n from pg_policies where schemaname = 'public'
`);
check('policies are in place', policyCount.rows[0].n >= 20, true);

const securityModes = await db.query(`
  select p.proname as name, p.prosecdef as definer
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname in ('save_kesht_bundle','claim_pending_invites','redeem_invite')
   order by p.proname
`);
check('save_kesht_bundle runs as invoker (so RLS applies)', securityModes.rows.find((r) => r.name === 'save_kesht_bundle')?.definer, false);
check('claim_pending_invites runs as definer', securityModes.rows.find((r) => r.name === 'claim_pending_invites')?.definer, true);
check('redeem_invite runs as definer', securityModes.rows.find((r) => r.name === 'redeem_invite')?.definer, true);

// ---------------------------------------------------------------------------
// An owner creates a kesht through the app's single save call
// ---------------------------------------------------------------------------

console.log('\nOwner creates a kesht');

const keshtId = 'kesht-1';
const saveArgs = {
  p_kesht: {
    id: keshtId,
    name: 'Friends',
    monthly_amount: 1000,
    currency: 'AFN',
    start_year: 1405,
    start_month: 1,
    status: 'active',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  p_members: [
    { id: 'm1', name: 'Ahmad', turn_order: 1, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { id: 'm2', name: 'Bilal', turn_order: 2, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  ],
  p_rounds: [
    { id: 'r1', sequence: 1, year: 1405, month: 1, recipient_member_id: 'm1', status: 'open', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  ],
  p_payments: [
    { id: 'p1', round_id: 'r1', member_id: 'm1', amount: 1000, paid: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { id: 'p2', round_id: 'r1', member_id: 'm2', amount: 1000, paid: false, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  ],
};

await as(db, OWNER, 'select save_kesht_bundle($1, $2, $3, $4)', [
  JSON.stringify(saveArgs.p_kesht),
  JSON.stringify(saveArgs.p_members),
  JSON.stringify(saveArgs.p_rounds),
  JSON.stringify(saveArgs.p_payments),
]);
console.log('  ok   save_kesht_bundle succeeded for the owner');

const membership = await db.query(`select role from kesht_members where kesht_id = 'kesht-1'`);
check('the trigger made the creator the owner', membership.rows.map((r) => r.role), ['owner']);

const ownerView = await as(db, OWNER, 'select id from keshts');
check('the owner can read the kesht back', ownerView.rows.length, 1);

const childCounts = await as(db, OWNER, `
  select (select count(*)::int from members) as members,
         (select count(*)::int from rounds) as rounds,
         (select count(*)::int from payments) as payments
`);
check('members, rounds and payments were written', childCounts.rows[0], { members: 2, rounds: 1, payments: 2 });

// ---------------------------------------------------------------------------
// Inviting by email, then claiming it
// ---------------------------------------------------------------------------

console.log('\nSharing by email');

await as(db, OWNER, 'insert into kesht_members (kesht_id, role, invited_email) values ($1, $2, $3)', [
  keshtId,
  'viewer',
  VIEWER.email,
]);

const viewerBeforeClaim = await as(db, VIEWER, 'select id from keshts');
check('a pending invite gives no access yet', viewerBeforeClaim.rows.length, 0);

const claimed = await as(db, VIEWER, 'select claim_pending_invites() as n');
check('claim_pending_invites turns it into access', claimed.rows[0].n, 1);

const viewerAfterClaim = await as(db, VIEWER, 'select id from keshts');
check('the viewer can now read the kesht', viewerAfterClaim.rows.length, 1);

const viewerCanReadChildren = await as(db, VIEWER, `
  select (select count(*)::int from members) as members,
         (select count(*)::int from rounds) as rounds,
         (select count(*)::int from payments) as payments
`);
check('the viewer can read members, rounds and payments', viewerCanReadChildren.rows[0], { members: 2, rounds: 1, payments: 2 });

// ---------------------------------------------------------------------------
// The important part: a viewer is genuinely read-only
// ---------------------------------------------------------------------------

console.log('\nA shared viewer is read-only');

const renamed = await as(db, VIEWER, `update keshts set name = 'hacked' where id = 'kesht-1' returning id`);
check('cannot rename the kesht (0 rows touched)', renamed.rows.length, 0);

const deleted = await as(db, VIEWER, `delete from keshts where id = 'kesht-1' returning id`);
check('cannot delete the kesht (0 rows touched)', deleted.rows.length, 0);

const paid = await as(db, VIEWER, `update payments set paid = true where id = 'p2' returning id`);
check('cannot mark a payment as paid', paid.rows.length, 0);

const removedMember = await as(db, VIEWER, `delete from members where id = 'm2' returning id`);
check('cannot remove a member', removedMember.rows.length, 0);

await asExpectFailure(db, VIEWER, 'cannot add a member', `insert into members (id, kesht_id, name, turn_order) values ('m3', 'kesht-1', 'Sneaky', 3)`);

await asExpectFailure(db, VIEWER, 'cannot push changes through save_kesht_bundle', 'select save_kesht_bundle($1, $2, $3, $4)', [
  JSON.stringify({ ...saveArgs.p_kesht, name: 'rewritten' }),
  JSON.stringify(saveArgs.p_members),
  JSON.stringify(saveArgs.p_rounds),
  JSON.stringify(saveArgs.p_payments),
]);

const nameAfter = await as(db, OWNER, `select name from keshts where id = 'kesht-1'`);
check('the kesht is untouched after every attempt', nameAfter.rows[0].name, 'Friends');

// ---------------------------------------------------------------------------
// A stranger sees nothing at all
// ---------------------------------------------------------------------------

console.log('\nA stranger sees nothing');

const strangerKeshts = await as(db, STRANGER, 'select id from keshts');
check('no keshts visible', strangerKeshts.rows.length, 0);

const strangerPayments = await as(db, STRANGER, 'select id from payments');
check('no payments visible', strangerPayments.rows.length, 0);

const strangerMemberships = await as(db, STRANGER, 'select id from kesht_members');
check('no membership rows visible', strangerMemberships.rows.length, 0);

// ---------------------------------------------------------------------------
// Share links
// ---------------------------------------------------------------------------

console.log('\nShare links');

await as(db, OWNER, `insert into kesht_invites (kesht_id, token, created_by) values ($1, 'tok-good', $2)`, [
  keshtId,
  OWNER.sub,
]);

const redeemed = await as(db, STRANGER, `select redeem_invite('tok-good') as kesht`);
check('a shared link lets someone join', redeemed.rows[0].kesht, keshtId);

const strangerNow = await as(db, STRANGER, 'select id from keshts');
check('…and gives them read access', strangerNow.rows.length, 1);

const strangerRole = await as(db, STRANGER, `select role from kesht_members where user_id = $1`, [STRANGER.sub]);
check('…as a viewer, not an owner', strangerRole.rows.map((r) => r.role), ['viewer']);

const strangerWrite = await as(db, STRANGER, `update keshts set name = 'hacked' where id = 'kesht-1' returning id`);
check('…still read-only', strangerWrite.rows.length, 0);

await asExpectFailure(db, STRANGER, 'an unknown token is refused', `select redeem_invite('tok-nope')`);

await as(db, OWNER, `update kesht_invites set revoked_at = now() where token = 'tok-good'`);
await asExpectFailure(db, STRANGER, 'a revoked link is refused', `select redeem_invite('tok-good')`);

// A viewer must not be able to create invite links for someone else's kesht.
await asExpectFailure(
  db,
  VIEWER,
  'a viewer cannot create share links',
  `insert into kesht_invites (kesht_id, token, created_by) values ('kesht-1', 'tok-bad', '${VIEWER.sub}')`,
);

// ---------------------------------------------------------------------------
console.log(`\n${checks - failures.length}/${checks} checks passed`);
if (failures.length) {
  console.log('\nFailures:');
  for (const failure of failures) console.log(`  - ${failure}`);
  process.exit(1);
}
console.log('The access rules behave as intended.');
await db.close();
