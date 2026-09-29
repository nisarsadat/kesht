-- Kesht — checks for the access rules.
--
-- Run this in the Supabase SQL editor after 0001_init.sql.
-- Part 1 runs as-is. Part 2 needs two real accounts (see the note there).

-- ---------------------------------------------------------------------------
-- Part 1 — structure: every table exists with row level security switched on.
-- Expect: 6 rows, all with rls_enabled = true.
-- ---------------------------------------------------------------------------

select c.relname as table_name, c.relrowsecurity as rls_enabled
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public'
   and c.relname in ('keshts', 'members', 'rounds', 'payments', 'kesht_members', 'kesht_invites')
 order by c.relname;

-- Policies in place. Expect `keshts` to have select/insert/update/delete and
-- `kesht_members` to have four, with no table left without policies.
select tablename, cmd, policyname
  from pg_policies
 where schemaname = 'public'
 order by tablename, cmd;

-- Functions exist with the intended security mode. Expect:
--   save_kesht_bundle    -> invoker    (row level security applies)
--   claim_pending_invites -> definer
--   redeem_invite        -> definer
--   is_kesht_member/owner, is_round_member, can_edit_kesht/round -> definer
select p.proname as function_name, p.prosecdef as security_definer
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and p.proname in (
     'save_kesht_bundle', 'claim_pending_invites', 'redeem_invite',
     'is_kesht_member', 'is_kesht_owner', 'is_round_member',
     'can_edit_kesht', 'can_edit_round'
   )
 order by p.proname;

-- ---------------------------------------------------------------------------
-- Part 2 — behaviour: a shared member can read but cannot change.
--
-- Create two accounts first (sign up twice through the app, or add users in
-- Authentication -> Users), then paste their ids here and run this block.
-- Everything is rolled back at the end, so it leaves no data behind.
--
-- Replace these two values:
--   <OWNER_UUID>  the account that owns the kesht
--   <MEMBER_UUID> the account it is shared with
-- ---------------------------------------------------------------------------

/*
begin;

insert into public.keshts (id, user_id, name, monthly_amount, currency, start_year, start_month, status)
values ('verify-kesht', '<OWNER_UUID>', 'verify', 1000, 'AFN', 1405, 1, 'draft');

-- The trigger should have made the creator the owner.
select count(*) as owner_rows from public.kesht_members
 where kesht_id = 'verify-kesht' and role = 'owner';
-- expect 1

insert into public.kesht_members (kesht_id, user_id, role)
values ('verify-kesht', '<MEMBER_UUID>', 'member');

-- Act as the member.
set local role authenticated;
set local request.jwt.claims = '{"sub":"<MEMBER_UUID>","email":"member@example.com"}';

select count(*) as member_can_see from public.keshts where id = 'verify-kesht';
-- expect 1  (read access works)

-- Each of these must fail or change nothing, because a member is read-only.
update public.keshts set name = 'hacked' where id = 'verify-kesht';
-- expect 0 rows updated

delete from public.keshts where id = 'verify-kesht';
-- expect 0 rows deleted

insert into public.members (id, kesht_id, name, turn_order)
values ('verify-member', 'verify-kesht', 'sneaky', 1);
-- expect: new row violates row-level security policy

select public.redeem_invite('does-not-exist');
-- expect: invite_invalid

rollback;
*/

-- ---------------------------------------------------------------------------
-- Part 3 — a quick look at what is actually stored.
-- ---------------------------------------------------------------------------

select k.id, k.name, k.status, k.monthly_amount,
       (select count(*) from public.members m where m.kesht_id = k.id) as members,
       (select count(*) from public.rounds r where r.kesht_id = k.id)  as rounds,
       (select count(*) from public.kesht_members km where km.kesht_id = k.id) as people_with_access
  from public.keshts k
 order by k.updated_at desc
 limit 20;
