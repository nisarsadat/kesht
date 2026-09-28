-- Kesht — Supabase schema, access rules and functions.
--
-- Paste this whole file into the Supabase SQL editor and run it once.
-- It is safe to run again: every object is created with "if not exists" or
-- replaced, and policies are dropped before being recreated.
--
-- Ids stay `text` (not `uuid`) because the app generates its own ids and the
-- phone app's SQLite schema uses TEXT for the same columns, which keeps the two
-- schemas compatible.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.keshts (
  id             text primary key,
  user_id        uuid not null references auth.users (id) on delete cascade,
  name           text not null,
  monthly_amount integer not null check (monthly_amount > 0),
  currency       text not null default 'AFN',
  start_year     integer not null,
  start_month    integer not null check (start_month between 1 and 12),
  status         text not null check (status in ('draft', 'active', 'completed')),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table if not exists public.members (
  id         text primary key,
  kesht_id   text not null references public.keshts (id) on delete cascade,
  name       text not null,
  father_name text,
  phone      text,
  note       text,
  turn_order integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.rounds (
  id                  text primary key,
  kesht_id            text not null references public.keshts (id) on delete cascade,
  sequence            integer not null,
  year                integer not null,
  month               integer not null,
  recipient_member_id text references public.members (id) on delete set null,
  status              text not null check (status in ('open', 'closed')),
  closed_at           timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create table if not exists public.payments (
  id         text primary key,
  round_id   text not null references public.rounds (id) on delete cascade,
  member_id  text not null references public.members (id) on delete cascade,
  amount     integer not null,
  paid       boolean not null default false,
  paid_at    timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Who can see which kesht. The owner has full control, everyone else is a
-- read-only viewer. A row with a null user_id is a pending email invite that
-- is claimed when somebody signs up with that address.
create table if not exists public.kesht_members (
  id            uuid primary key default gen_random_uuid(),
  kesht_id      text not null references public.keshts (id) on delete cascade,
  user_id       uuid references auth.users (id) on delete cascade,
  role          text not null check (role in ('owner', 'viewer')),
  invited_email text,
  created_at    timestamptz not null default now()
);

-- Share links. Anyone signed in who opens a live token can join as a viewer.
create table if not exists public.kesht_invites (
  id         uuid primary key default gen_random_uuid(),
  kesht_id   text not null references public.keshts (id) on delete cascade,
  token      text not null unique,
  created_by uuid not null references auth.users (id) on delete cascade,
  expires_at timestamptz not null default now() + interval '30 days',
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

create index if not exists members_kesht_idx        on public.members (kesht_id);
create index if not exists rounds_kesht_idx         on public.rounds (kesht_id);
create index if not exists payments_round_idx       on public.payments (round_id);
create index if not exists payments_member_idx      on public.payments (member_id);
create index if not exists kesht_members_user_idx   on public.kesht_members (user_id);
create index if not exists kesht_members_kesht_idx  on public.kesht_members (kesht_id);
create index if not exists kesht_invites_kesht_idx  on public.kesht_invites (kesht_id);

-- One membership row per person per kesht, and one pending invite per email.
create unique index if not exists kesht_members_kesht_user_key
  on public.kesht_members (kesht_id, user_id) where user_id is not null;
create unique index if not exists kesht_members_kesht_email_key
  on public.kesht_members (kesht_id, lower(invited_email))
  where user_id is null and invited_email is not null;

-- ---------------------------------------------------------------------------
-- Access helpers
--
-- These are SECURITY DEFINER on purpose: the policies on the child tables need
-- to ask "can this user see the kesht this row belongs to?", and doing that
-- with a plain query would re-enter row level security on kesht_members and
-- recurse forever. Read-only and stable, so they are cheap to call.
-- ---------------------------------------------------------------------------

create or replace function public.is_kesht_member(p_kesht_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from kesht_members m
    where m.kesht_id = p_kesht_id and m.user_id = auth.uid()
  );
$$;

create or replace function public.is_kesht_owner(p_kesht_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from kesht_members m
    where m.kesht_id = p_kesht_id and m.user_id = auth.uid() and m.role = 'owner'
  );
$$;

create or replace function public.is_round_member(p_round_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from rounds r
    join kesht_members m on m.kesht_id = r.kesht_id
    where r.id = p_round_id and m.user_id = auth.uid()
  );
$$;

create or replace function public.is_round_owner(p_round_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from rounds r
    join kesht_members m on m.kesht_id = r.kesht_id
    where r.id = p_round_id and m.user_id = auth.uid() and m.role = 'owner'
  );
$$;

-- Creating a kesht makes you its owner. Doing this in a trigger means the
-- ownership row can never be skipped or get out of sync with the client.
create or replace function public.add_owner_membership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into kesht_members (kesht_id, user_id, role)
  values (new.id, new.user_id, 'owner')
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists keshts_add_owner on public.keshts;
create trigger keshts_add_owner
  after insert on public.keshts
  for each row execute function public.add_owner_membership();

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.keshts        enable row level security;
alter table public.members       enable row level security;
alter table public.rounds        enable row level security;
alter table public.payments      enable row level security;
alter table public.kesht_members enable row level security;
alter table public.kesht_invites enable row level security;

-- keshts: you can read a kesht you belong to, only its owner can change it.
drop policy if exists keshts_select on public.keshts;
create policy keshts_select on public.keshts
  for select to authenticated using (public.is_kesht_member(id));

drop policy if exists keshts_insert on public.keshts;
create policy keshts_insert on public.keshts
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists keshts_update on public.keshts;
create policy keshts_update on public.keshts
  for update to authenticated
  using (public.is_kesht_owner(id))
  with check (public.is_kesht_owner(id));

drop policy if exists keshts_delete on public.keshts;
create policy keshts_delete on public.keshts
  for delete to authenticated using (public.is_kesht_owner(id));

-- members
drop policy if exists members_select on public.members;
create policy members_select on public.members
  for select to authenticated using (public.is_kesht_member(kesht_id));

drop policy if exists members_insert on public.members;
create policy members_insert on public.members
  for insert to authenticated with check (public.is_kesht_owner(kesht_id));

drop policy if exists members_update on public.members;
create policy members_update on public.members
  for update to authenticated
  using (public.is_kesht_owner(kesht_id))
  with check (public.is_kesht_owner(kesht_id));

drop policy if exists members_delete on public.members;
create policy members_delete on public.members
  for delete to authenticated using (public.is_kesht_owner(kesht_id));

-- rounds
drop policy if exists rounds_select on public.rounds;
create policy rounds_select on public.rounds
  for select to authenticated using (public.is_kesht_member(kesht_id));

drop policy if exists rounds_insert on public.rounds;
create policy rounds_insert on public.rounds
  for insert to authenticated with check (public.is_kesht_owner(kesht_id));

drop policy if exists rounds_update on public.rounds;
create policy rounds_update on public.rounds
  for update to authenticated
  using (public.is_kesht_owner(kesht_id))
  with check (public.is_kesht_owner(kesht_id));

drop policy if exists rounds_delete on public.rounds;
create policy rounds_delete on public.rounds
  for delete to authenticated using (public.is_kesht_owner(kesht_id));

-- payments (reach the kesht through their round)
drop policy if exists payments_select on public.payments;
create policy payments_select on public.payments
  for select to authenticated using (public.is_round_member(round_id));

drop policy if exists payments_insert on public.payments;
create policy payments_insert on public.payments
  for insert to authenticated with check (public.is_round_owner(round_id));

drop policy if exists payments_update on public.payments;
create policy payments_update on public.payments
  for update to authenticated
  using (public.is_round_owner(round_id))
  with check (public.is_round_owner(round_id));

drop policy if exists payments_delete on public.payments;
create policy payments_delete on public.payments
  for delete to authenticated using (public.is_round_owner(round_id));

-- kesht_members: you always see your own row, the owner sees everybody.
drop policy if exists kesht_members_select on public.kesht_members;
create policy kesht_members_select on public.kesht_members
  for select to authenticated
  using (user_id = auth.uid() or public.is_kesht_owner(kesht_id));

drop policy if exists kesht_members_insert on public.kesht_members;
create policy kesht_members_insert on public.kesht_members
  for insert to authenticated with check (public.is_kesht_owner(kesht_id));

drop policy if exists kesht_members_update on public.kesht_members;
create policy kesht_members_update on public.kesht_members
  for update to authenticated
  using (public.is_kesht_owner(kesht_id))
  with check (public.is_kesht_owner(kesht_id));

drop policy if exists kesht_members_delete on public.kesht_members;
create policy kesht_members_delete on public.kesht_members
  for delete to authenticated using (public.is_kesht_owner(kesht_id));

-- kesht_invites: only the owner manages links.
drop policy if exists kesht_invites_select on public.kesht_invites;
create policy kesht_invites_select on public.kesht_invites
  for select to authenticated using (public.is_kesht_owner(kesht_id));

drop policy if exists kesht_invites_insert on public.kesht_invites;
create policy kesht_invites_insert on public.kesht_invites
  for insert to authenticated
  with check (public.is_kesht_owner(kesht_id) and created_by = auth.uid());

drop policy if exists kesht_invites_update on public.kesht_invites;
create policy kesht_invites_update on public.kesht_invites
  for update to authenticated
  using (public.is_kesht_owner(kesht_id))
  with check (public.is_kesht_owner(kesht_id));

drop policy if exists kesht_invites_delete on public.kesht_invites;
create policy kesht_invites_delete on public.kesht_invites
  for delete to authenticated using (public.is_kesht_owner(kesht_id));

-- ---------------------------------------------------------------------------
-- save_kesht_bundle
--
-- Every change in the app rewrites one kesht and its members, rounds and
-- payments, exactly like the phone app's persist(). One call, one transaction,
-- so a half-applied change can never be left behind. SECURITY INVOKER, so row
-- level security still applies to everything it touches.
-- ---------------------------------------------------------------------------

create or replace function public.save_kesht_bundle(
  p_kesht    jsonb,
  p_members  jsonb,
  p_rounds   jsonb,
  p_payments jsonb
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_id text := p_kesht ->> 'id';
begin
  if v_id is null or v_id = '' then
    raise exception 'kesht id is required';
  end if;

  -- Deliberately not "insert ... on conflict do update": that form also has to
  -- satisfy the UPDATE policy, and for a brand new kesht the owner membership
  -- does not exist until the after-insert trigger has run, so it can never pass.
  if exists (select 1 from keshts where id = v_id) then
    update keshts set
      name           = p_kesht ->> 'name',
      monthly_amount = (p_kesht ->> 'monthly_amount')::integer,
      start_year     = (p_kesht ->> 'start_year')::integer,
      start_month    = (p_kesht ->> 'start_month')::integer,
      status         = p_kesht ->> 'status',
      updated_at     = coalesce((p_kesht ->> 'updated_at')::timestamptz, now())
    where id = v_id;

    -- Where the owner would have matched; anyone else stops here with a clear
    -- reason instead of silently changing nothing.
    if not found then
      raise exception 'kesht_not_found_or_not_owner';
    end if;
  else
    insert into keshts (
      id, user_id, name, monthly_amount, currency, start_year, start_month,
      status, created_at, updated_at
    )
    values (
      v_id,
      auth.uid(),
      p_kesht ->> 'name',
      (p_kesht ->> 'monthly_amount')::integer,
      coalesce(p_kesht ->> 'currency', 'AFN'),
      (p_kesht ->> 'start_year')::integer,
      (p_kesht ->> 'start_month')::integer,
      p_kesht ->> 'status',
      coalesce((p_kesht ->> 'created_at')::timestamptz, now()),
      coalesce((p_kesht ->> 'updated_at')::timestamptz, now())
    );
  end if;

  delete from payments
   where round_id in (select id from rounds where kesht_id = v_id);
  delete from rounds where kesht_id = v_id;
  delete from members where kesht_id = v_id;

  -- Column order in the select matches the insert list: r.id is the member id,
  -- v_id is the kesht this member belongs to.
  insert into members (id, kesht_id, name, father_name, phone, note, turn_order, created_at, updated_at)
  select r.id, v_id, r.name, r.father_name, r.phone, r.note, r.turn_order, r.created_at, r.updated_at
  from jsonb_to_recordset(coalesce(p_members, '[]'::jsonb)) as r(
    id text, name text, father_name text, phone text, note text,
    turn_order integer, created_at timestamptz, updated_at timestamptz
  );

  insert into rounds (id, kesht_id, sequence, year, month, recipient_member_id, status, closed_at, created_at, updated_at)
  select r.id, v_id, r.sequence, r.year, r.month, r.recipient_member_id, r.status, r.closed_at, r.created_at, r.updated_at
  from jsonb_to_recordset(coalesce(p_rounds, '[]'::jsonb)) as r(
    id text, sequence integer, year integer, month integer, recipient_member_id text,
    status text, closed_at timestamptz, created_at timestamptz, updated_at timestamptz
  );

  insert into payments (id, round_id, member_id, amount, paid, paid_at, created_at, updated_at)
  select r.id, r.round_id, r.member_id, r.amount, r.paid, r.paid_at, r.created_at, r.updated_at
  from jsonb_to_recordset(coalesce(p_payments, '[]'::jsonb)) as r(
    id text, round_id text, member_id text, amount integer, paid boolean,
    paid_at timestamptz, created_at timestamptz, updated_at timestamptz
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- claim_pending_invites
--
-- Called right after sign-in: turns any pending email invite that matches the
-- signed-in address into a real membership. SECURITY DEFINER because a user
-- cannot write membership rows for someone else's kesht, so the match is done
-- here against the caller's own verified email and nothing else.
-- ---------------------------------------------------------------------------

create or replace function public.claim_pending_invites()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
  v_email text := auth.jwt() ->> 'email';
begin
  if auth.uid() is null or v_email is null then
    return 0;
  end if;

  update kesht_members
     set user_id = auth.uid()
   where user_id is null
     and invited_email is not null
     and lower(invited_email) = lower(v_email);

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- redeem_invite
--
-- Joins the caller to a kesht from a share link, as a viewer. Returns the
-- kesht id so the app can open it. SECURITY DEFINER for the same reason:
-- membership rows for someone else's kesht are otherwise not writable.
-- ---------------------------------------------------------------------------

create or replace function public.redeem_invite(p_token text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite kesht_invites;
  v_uid uuid := auth.uid();
  v_email text := auth.jwt() ->> 'email';
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  select * into v_invite
    from kesht_invites
   where token = p_token
     and revoked_at is null
     and expires_at > now()
   limit 1;

  if v_invite.id is null then
    raise exception 'invite_invalid';
  end if;

  insert into kesht_members (kesht_id, user_id, role, invited_email)
  values (v_invite.kesht_id, v_uid, 'viewer', v_email)
  on conflict do nothing;

  return v_invite.kesht_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Permissions: signed-in users only, never anonymous visitors.
--
-- Supabase grants these by default, but spelling them out means this file also
-- works on a plain Postgres, and that nothing depends on project defaults.
-- ---------------------------------------------------------------------------

grant usage on schema public to authenticated;

grant select, insert, update, delete on public.keshts        to authenticated;
grant select, insert, update, delete on public.members       to authenticated;
grant select, insert, update, delete on public.rounds        to authenticated;
grant select, insert, update, delete on public.payments      to authenticated;
grant select, insert, update, delete on public.kesht_members to authenticated;
grant select, insert, update, delete on public.kesht_invites to authenticated;

revoke all on function public.save_kesht_bundle(jsonb, jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.save_kesht_bundle(jsonb, jsonb, jsonb, jsonb) to authenticated;

revoke all on function public.claim_pending_invites() from public, anon;
grant execute on function public.claim_pending_invites() to authenticated;

revoke all on function public.redeem_invite(text) from public, anon;
grant execute on function public.redeem_invite(text) to authenticated;
