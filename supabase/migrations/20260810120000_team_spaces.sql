-- ============================================================================
-- TEAM MODE — foundation schema
--
-- Design constraints this migration enforces IN THE DATABASE (not in the UI,
-- and not by convention). Every one of these came out of the adversarial
-- threat model; if a later change relaxes one, the corresponding attack opens.
--
--  1. MEMBERSHIP IS EXPLICIT CONSENT. A team space is a ROW, never a match on
--     profiles.team_number. profiles.team_number stays a self-declared display
--     label — squatting it must buy nothing. Nothing in this file reads it.
--  2. NO FREE TEXT EVER TRAVELS USER→USER. team_spaces.name is CHECK-pinned to
--     the derived string 'Team <n>'; there is no description, no invite note,
--     no nudge text, no removal reason. A lead cannot type anything a minor
--     will read.
--  3. NO ROLE IS WORTH LYING ABOUT. profiles.role (student/mentor/coach/…) is
--     self-asserted and appears NOWHERE in this file. Authority is "you own
--     the row", earned by creating a space, never claimed from a dropdown.
--  4. OWNERSHIP IS IMMUTABLE. created_by / team_number / program cannot be
--     UPDATEd — enforced by trigger, so even a service-role bug is caught.
--     There are no co-leads, no promote-to-lead and no ownership transfer.
--  5. YOUR PROGRESS IS VISIBLE TO AT MOST ONE SPACE, EVER. A partial unique
--     index allows one ACTIVE membership per user across the whole platform.
--  6. REVOCATION IS STRUCTURAL. Progress is read by joining THROUGH the
--     membership row; nothing is denormalised onto the space. Deleting the
--     membership row therefore revokes the lead's visibility instantly, and a
--     removal touches no other table, so it cannot damage the removed user.
--  7. INVITE TOKENS ARE UNREADABLE BY ANY CLIENT ROLE. team_invites.token has
--     no column grant to anon or authenticated at all; the lead sees it only
--     through server code that has re-derived their leadership.
-- ============================================================================

-- ── team_spaces ─────────────────────────────────────────────────────────────
create table if not exists public.team_spaces (
  id          uuid primary key default gen_random_uuid(),
  program     text        not null default 'frc',
  team_number integer     not null,
  -- DERIVED, never typed. The CHECK is the enforcement point for "no free text
  -- user→user": a lead physically cannot smuggle a message into the space name
  -- that an invited minor would then read on the consent screen.
  name        text        not null,
  created_by  uuid        not null references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  constraint team_spaces_program_chk check (program in ('frc', 'ftc', 'fll')),
  constraint team_spaces_number_chk  check (team_number between 1 and 99999),
  constraint team_spaces_name_chk    check (name = 'Team ' || team_number::text)
);

-- One space per real team: first claimer wins, a second claim is refused and
-- the claimer is told to ask for an invite instead. Also closes the "squat
-- every famous team number" denial vector.
create unique index if not exists team_spaces_program_number_key
  on public.team_spaces (program, team_number);

-- One space OWNED per account. There is no legitimate second, and this caps
-- the blast radius of a single abusive signup.
create unique index if not exists team_spaces_one_per_owner_key
  on public.team_spaces (created_by);

comment on table public.team_spaces is
  'A consented team workspace. Keyed by its own id — NEVER by profiles.team_number.';

-- ── team_space_members ──────────────────────────────────────────────────────
-- status: invited → active. A row is created 'active' only by the USER''s own
-- accept. There is no lead-side "add member".
create table if not exists public.team_space_members (
  space_id   uuid        not null references public.team_spaces(id) on delete cascade,
  user_id    uuid        not null references auth.users(id) on delete cascade,
  role       text        not null default 'member',
  status     text        not null default 'invited',
  invited_by uuid        references auth.users(id) on delete set null,
  invite_id  uuid,  -- FK added after team_invites exists
  invited_at timestamptz not null default now(),
  joined_at  timestamptz,
  primary key (space_id, user_id),
  constraint tsm_role_chk   check (role in ('lead', 'member')),
  constraint tsm_status_chk check (status in ('invited', 'active')),
  -- active ⇔ they accepted. joined_at is the consent timestamp; it cannot be
  -- set without status flipping, and status cannot flip without it.
  constraint tsm_joined_chk check ((status = 'active') = (joined_at is not null)),
  -- a lead is by construction the creator, who is active from the first row
  constraint tsm_lead_active_chk check (role <> 'lead' or status = 'active')
);

-- Exactly one lead per space. No co-leads.
create unique index if not exists team_space_members_one_lead_key
  on public.team_space_members (space_id) where role = 'lead';

-- THE PRIVACY INVARIANT: at most one space can see any given user's progress.
create unique index if not exists team_space_members_one_active_per_user_key
  on public.team_space_members (user_id) where status = 'active';

-- "do I have a pending invite / which space am I in" — the hot per-user path.
create index if not exists team_space_members_user_idx
  on public.team_space_members (user_id);

-- roster read
create index if not exists team_space_members_space_status_idx
  on public.team_space_members (space_id, status);

-- ── team_invites ────────────────────────────────────────────────────────────
-- Link invites only. There is deliberately no invite-by-email and no
-- invite-by-username here: an email invite would make this platform an
-- outbound-mail primitive aimed at strangers, and a username lookup would be a
-- user-existence oracle. The lead pastes the link into the Discord/GroupMe the
-- team already uses, so LearnFRC never becomes the contact channel between an
-- adult and a minor.
create table if not exists public.team_invites (
  id         uuid        primary key default gen_random_uuid(),
  space_id   uuid        not null references public.team_spaces(id) on delete cascade,
  -- 128 bits of crypto.randomBytes, base64url. NOT readable by anon or
  -- authenticated (see the grants at the bottom of this file) — the column has
  -- no grant at all, so PostgREST cannot return it under any policy.
  token      text        not null unique,
  created_by uuid        not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  max_uses   integer     not null default 25,
  uses       integer     not null default 0,
  revoked_at timestamptz,
  constraint ti_max_uses_chk check (max_uses between 1 and 100),
  constraint ti_uses_chk     check (uses >= 0 and uses <= max_uses),
  constraint ti_expiry_chk   check (expires_at > created_at)
);

-- AT MOST ONE LIVE LINK PER SPACE, enforced by the database. "Reset invite
-- link" revokes the old row in the same statement that creates the new one, so
-- a leaked link is dead the instant it is rotated and there is no way to
-- accumulate forgotten live links.
create unique index if not exists team_invites_one_live_per_space_key
  on public.team_invites (space_id) where revoked_at is null;

create index if not exists team_invites_space_idx
  on public.team_invites (space_id);

alter table public.team_space_members
  drop constraint if exists team_space_members_invite_id_fkey;
alter table public.team_space_members
  add constraint team_space_members_invite_id_fkey
  foreign key (invite_id) references public.team_invites(id) on delete set null;

-- ── team_space_blocks ───────────────────────────────────────────────────────
-- A member's permanent, self-service veto. Survives leaving: once you block a
-- space, no link from that space can ever admit you again, whatever the lead
-- does. This is the control that makes "leave" safe to offer without approval.
create table if not exists public.team_space_blocks (
  space_id   uuid        not null references public.team_spaces(id) on delete cascade,
  user_id    uuid        not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (space_id, user_id)
);

-- ── team_space_plan_items ───────────────────────────────────────────────────
-- The "suggested training plan". A plan item is a DEPARTMENT ID FROM A FIXED
-- LIST — that is the entire payload. No title, no note, no due date, nothing a
-- lead can type. user_id null = suggested for the whole space.
create table if not exists public.team_space_plan_items (
  id            uuid        primary key default gen_random_uuid(),
  space_id      uuid        not null references public.team_spaces(id) on delete cascade,
  user_id       uuid        references auth.users(id) on delete cascade,
  department_id uuid        not null references public.departments(id) on delete cascade,
  assigned_by   uuid        not null references auth.users(id) on delete cascade,
  assigned_at   timestamptz not null default now()
);

-- Dedupe. coalesce() rather than NULLS NOT DISTINCT so this does not depend on
-- the Postgres major version.
create unique index if not exists team_space_plan_items_uniq_key
  on public.team_space_plan_items
     (space_id, coalesce(user_id, '00000000-0000-0000-0000-000000000000'::uuid), department_id);

create index if not exists team_space_plan_items_space_idx
  on public.team_space_plan_items (space_id);

-- ── team_space_events ───────────────────────────────────────────────────────
-- The record that lets a parent or a school be answered later. There is no
-- equivalent for the old auto-grouped /teams page. Fixed action vocabulary, no
-- free-text column — the log itself must not become a message channel.
create table if not exists public.team_space_events (
  id             bigserial   primary key,
  space_id       uuid        not null references public.team_spaces(id) on delete cascade,
  actor_id       uuid        references auth.users(id) on delete set null,
  action         text        not null,
  target_user_id uuid        references auth.users(id) on delete set null,
  at             timestamptz not null default now(),
  constraint tse_action_chk check (action in (
    'space_create', 'invite_create', 'invite_revoke', 'accept',
    'leave', 'remove', 'block', 'plan_set', 'plan_clear', 'space_delete'
  ))
);

create index if not exists team_space_events_space_at_idx
  on public.team_space_events (space_id, at desc);
create index if not exists team_space_events_target_idx
  on public.team_space_events (target_user_id);

-- ── immutability triggers ───────────────────────────────────────────────────
-- Ownership escalation is the attack that turns this feature into a problem,
-- so the ban lives in Postgres, not in TypeScript. A mass-assignment bug in a
-- future server action cannot get past this.
create or replace function public.team_spaces_immutable()
returns trigger
language plpgsql
as $$
begin
  if new.created_by  is distinct from old.created_by
  or new.team_number is distinct from old.team_number
  or new.program     is distinct from old.program
  or new.id          is distinct from old.id then
    raise exception 'team_spaces: created_by, team_number, program and id are immutable';
  end if;
  return new;
end;
$$;

drop trigger if exists team_spaces_immutable_trg on public.team_spaces;
create trigger team_spaces_immutable_trg
  before update on public.team_spaces
  for each row execute function public.team_spaces_immutable();

-- No promote-to-lead, no demote, and no un-accepting someone. Membership can
-- go invited → active (the user accepting) and nowhere else.
create or replace function public.team_space_members_guard()
returns trigger
language plpgsql
as $$
begin
  if new.role is distinct from old.role then
    raise exception 'team_space_members: role is immutable (no promote-to-lead)';
  end if;
  if old.status = 'active' and new.status <> 'active' then
    raise exception 'team_space_members: status cannot move back from active';
  end if;
  if new.user_id is distinct from old.user_id
  or new.space_id is distinct from old.space_id then
    raise exception 'team_space_members: identity is immutable';
  end if;
  return new;
end;
$$;

drop trigger if exists team_space_members_guard_trg on public.team_space_members;
create trigger team_space_members_guard_trg
  before update on public.team_space_members
  for each row execute function public.team_space_members_guard();

-- A space always has its lead. Doing this in a trigger rather than a second
-- client round-trip makes "space exists but has no lead" unrepresentable.
create or replace function public.team_spaces_seed_lead()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.team_space_members
    (space_id, user_id, role, status, invited_by, invited_at, joined_at)
  values (new.id, new.created_by, 'lead', 'active', new.created_by, now(), now());
  insert into public.team_space_events (space_id, actor_id, action, target_user_id)
  values (new.id, new.created_by, 'space_create', new.created_by);
  return new;
end;
$$;

drop trigger if exists team_spaces_seed_lead_trg on public.team_spaces;
create trigger team_spaces_seed_lead_trg
  after insert on public.team_spaces
  for each row execute function public.team_spaces_seed_lead();

-- ── membership predicates (SECURITY DEFINER) ────────────────────────────────
-- RLS on team_space_members has to ask "is the caller a member of this space",
-- which is a question about team_space_members itself — a policy that queried
-- the table directly would recurse. These run SECURITY DEFINER so the lookup
-- bypasses RLS, and they take ONLY a space id: auth.uid() is supplied
-- internally, so neither function can be turned into an oracle about a third
-- party ("is user X in space Y" is unaskable).
create or replace function public.is_team_space_member(p_space uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.team_space_members m
     where m.space_id = p_space
       and m.user_id  = auth.uid()
       and m.status   = 'active'
  );
$$;

create or replace function public.is_team_space_lead(p_space uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.team_space_members m
     where m.space_id = p_space
       and m.user_id  = auth.uid()
       and m.status   = 'active'
       and m.role     = 'lead'
  );
$$;

revoke all on function public.is_team_space_member(uuid) from public, anon;
revoke all on function public.is_team_space_lead(uuid)   from public, anon;
-- authenticated must keep EXECUTE: RLS policy expressions are evaluated with
-- the caller's privileges, so revoking it here would make every policy below
-- fail with "permission denied for function" instead of simply denying rows.
grant execute on function public.is_team_space_member(uuid) to authenticated, service_role;
grant execute on function public.is_team_space_lead(uuid)   to authenticated, service_role;

-- ── redeem_team_invite (atomic accept) ──────────────────────────────────────
-- Validate + insert membership + increment uses + audit, in ONE statement.
-- Doing this as three PostgREST round-trips would let a 25-use link be redeemed
-- 40 times under concurrency. Returns a uniform 'invalid' for expired, revoked,
-- exhausted and non-existent tokens so a redeem attempt never reveals that a
-- space exists.
create or replace function public.redeem_team_invite(p_token text, p_user uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_invite public.team_invites%rowtype;
  v_status text;
begin
  select * into v_invite from public.team_invites where token = p_token for update;
  if not found
     or v_invite.revoked_at is not null
     or v_invite.expires_at <= now()
     or v_invite.uses >= v_invite.max_uses then
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;

  -- the member's permanent veto outranks any live link
  if exists (select 1 from public.team_space_blocks b
              where b.space_id = v_invite.space_id and b.user_id = p_user) then
    return jsonb_build_object('ok', false, 'reason', 'blocked');
  end if;

  select status into v_status from public.team_space_members
   where space_id = v_invite.space_id and user_id = p_user;
  if v_status = 'active' then
    return jsonb_build_object('ok', true, 'reason', 'already_member',
                              'space_id', v_invite.space_id);
  end if;

  if exists (select 1 from public.team_space_members m
              where m.user_id = p_user and m.status = 'active') then
    return jsonb_build_object('ok', false, 'reason', 'already_in_another_space');
  end if;

  insert into public.team_space_members
    (space_id, user_id, role, status, invited_by, invite_id, invited_at, joined_at)
  values
    (v_invite.space_id, p_user, 'member', 'active', v_invite.created_by,
     v_invite.id, now(), now())
  on conflict (space_id, user_id) do update
    set status = 'active', joined_at = now(), invite_id = excluded.invite_id;

  update public.team_invites set uses = uses + 1 where id = v_invite.id;

  insert into public.team_space_events (space_id, actor_id, action, target_user_id)
  values (v_invite.space_id, p_user, 'accept', p_user);

  return jsonb_build_object('ok', true, 'reason', 'joined', 'space_id', v_invite.space_id);
end;
$$;

-- Same posture as check_rate_limit: not pokeable via /rest/v1/rpc. Only trusted
-- server code, which has already run auth.getUser() and the redeem rate limit,
-- may call it.
revoke all on function public.redeem_team_invite(text, uuid) from public, anon, authenticated;
grant execute on function public.redeem_team_invite(text, uuid) to service_role;

-- ── RLS ─────────────────────────────────────────────────────────────────────
alter table public.team_spaces           enable row level security;
alter table public.team_space_members    enable row level security;
alter table public.team_invites          enable row level security;
alter table public.team_space_blocks     enable row level security;
alter table public.team_space_plan_items enable row level security;
alter table public.team_space_events     enable row level security;

-- Supabase's default privileges hand anon + authenticated everything on any new
-- table in `public`. Take it all back first, then grant back only what a
-- browser genuinely needs to READ. Every write goes through server code that
-- re-derives authority, so no write grant is issued to any client role.
revoke all on table public.team_spaces           from anon, authenticated;
revoke all on table public.team_space_members    from anon, authenticated;
revoke all on table public.team_invites          from anon, authenticated;
revoke all on table public.team_space_blocks     from anon, authenticated;
revoke all on table public.team_space_plan_items from anon, authenticated;
revoke all on table public.team_space_events     from anon, authenticated;

-- team_spaces: readable only by an ACTIVE member.
drop policy if exists team_spaces_select_member on public.team_spaces;
create policy team_spaces_select_member on public.team_spaces
  for select to authenticated
  using (public.is_team_space_member(id));
grant select (id, program, team_number, name, created_by, created_at)
  on public.team_spaces to authenticated;

-- team_space_members: an active member sees the roster of THEIR space; anyone
-- sees their own row (so a pending invitee can be told they have one) and
-- nothing else. A non-member gets zero rows — not an error — so the existence
-- of a space is never confirmed.
drop policy if exists team_space_members_select on public.team_space_members;
create policy team_space_members_select on public.team_space_members
  for select to authenticated
  using (user_id = auth.uid() or public.is_team_space_member(space_id));

-- One-click leave, self-service, no lead approval. Restricted to role<>'lead'
-- so a lead cannot orphan a space full of minors by walking out of it; a lead
-- deletes the space instead, which cascades.
drop policy if exists team_space_members_delete_self on public.team_space_members;
create policy team_space_members_delete_self on public.team_space_members
  for delete to authenticated
  using (user_id = auth.uid() and role <> 'lead');

grant select (space_id, user_id, role, status, invited_by, invited_at, joined_at)
  on public.team_space_members to authenticated;
grant delete on public.team_space_members to authenticated;

-- team_invites: the creating lead may see the invite's METADATA. `token` is
-- absent from the grant list, so no client role can read it under any policy —
-- which is the literal enforcement of "nobody may read invite tokens except the
-- creating lead", who gets it from server code instead.
drop policy if exists team_invites_select_lead on public.team_invites;
create policy team_invites_select_lead on public.team_invites
  for select to authenticated
  using (created_by = auth.uid() and public.is_team_space_lead(space_id));
grant select (id, space_id, created_by, created_at, expires_at, max_uses, uses, revoked_at)
  on public.team_invites to authenticated;
-- NO insert/update/delete policy and NO write grant: minting a token requires a
-- CSPRNG, a rate limit and rotation of the previous link, none of which a
-- browser can be trusted with. See createTeamInvite() in src/lib/team-space.ts.

-- blocks: you may see and create your own veto, and you may lift it. Nobody
-- else — a lead must not be able to see who blocked them (that would be a
-- retaliation signal).
drop policy if exists team_space_blocks_select_own on public.team_space_blocks;
create policy team_space_blocks_select_own on public.team_space_blocks
  for select to authenticated using (user_id = auth.uid());
drop policy if exists team_space_blocks_insert_own on public.team_space_blocks;
create policy team_space_blocks_insert_own on public.team_space_blocks
  for insert to authenticated with check (user_id = auth.uid());
drop policy if exists team_space_blocks_delete_own on public.team_space_blocks;
create policy team_space_blocks_delete_own on public.team_space_blocks
  for delete to authenticated using (user_id = auth.uid());
grant select (space_id, user_id, created_at) on public.team_space_blocks to authenticated;
grant insert (space_id, user_id), delete on public.team_space_blocks to authenticated;

-- plan items: visible to the space's active members. Written server-side only.
drop policy if exists team_space_plan_items_select on public.team_space_plan_items;
create policy team_space_plan_items_select on public.team_space_plan_items
  for select to authenticated
  using (public.is_team_space_member(space_id));
grant select (id, space_id, user_id, department_id, assigned_by, assigned_at)
  on public.team_space_plan_items to authenticated;

-- events: the lead sees their space's log; every user sees the entries about
-- themselves, wherever they occurred. Append-only from the client's point of
-- view (no insert/update/delete grant at all).
drop policy if exists team_space_events_select on public.team_space_events;
create policy team_space_events_select on public.team_space_events
  for select to authenticated
  using (target_user_id = auth.uid() or public.is_team_space_lead(space_id));
grant select (id, space_id, actor_id, action, target_user_id, at)
  on public.team_space_events to authenticated;

-- ── trigger-function hardening ──────────────────────────────────────────────
-- PostgREST exposes every function in `public` at /rest/v1/rpc, trigger
-- functions included, and these run SECURITY DEFINER or touch privileged
-- tables. Pin their search_path so a hostile schema earlier on the path cannot
-- shadow `team_space_members`, and revoke EXECUTE from every client role.
-- Postgres checks EXECUTE on a trigger function at CREATE TRIGGER time, not at
-- fire time, so the triggers above keep working.
alter function public.team_spaces_immutable()        set search_path = public, pg_temp;
alter function public.team_space_members_guard()     set search_path = public, pg_temp;

revoke all on function public.team_spaces_immutable()    from public, anon, authenticated;
revoke all on function public.team_space_members_guard() from public, anon, authenticated;
revoke all on function public.team_spaces_seed_lead()    from public, anon, authenticated;
