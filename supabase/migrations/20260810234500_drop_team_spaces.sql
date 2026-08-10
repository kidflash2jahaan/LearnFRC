-- ════════════════════════════════════════════════════════════════════════════
-- DROP TEAM SPACES — recorded, NOT APPLIED.
--
-- ⚠️  THIS MIGRATION HAS NOT BEEN RUN AGAINST ANY DATABASE. It is checked in so
--     the destructive step is reviewable in the diff. The lead applies it by
--     hand after reading it. Nothing in the app depends on these objects any
--     more — the entire Team Space feature (routes, actions, lib, components)
--     was deleted in this same change, so the tables below are already dead
--     weight and no code path reads or writes them.
--
-- WHY THE FEATURE WENT AWAY
-- /teams already rendered a team roster keyed off profiles.team_number. Team
-- Space added a second, worse roster behind a membership model nobody asked
-- for. The three parts that were genuinely new — an invite link, a QR of it,
-- and a printable handout — now live on /teams and /teams/print and are built
-- entirely on the referral link this site already ships:
--     https://learnfrc.com/signup?ref=<username>&via=team-invite
-- That needs no table, no token, no expiry and no membership row, which is
-- exactly why the schema below can go.
--
-- BEFORE YOU RUN THIS — read the data-loss note.
-- These tables hold real user data from the period the feature was live:
--   • team_space_members  — who joined whose space
--   • team_space_plan_items — the routes leads suggested
--   • team_space_events   — the audit log of every space action
-- None of it is referenced anywhere else (no foreign key in any other table
-- points INTO these), and none of it feeds XP, progress, streaks or
-- achievements — the plan feature was read-only by construction. So dropping
-- is safe, but it is also irreversible. Take a dump first if you want the
-- audit log preserved for the record:
--     pg_dump --data-only -t 'public.team_space*' -t public.team_invites …
--
-- ORDER. Tables are dropped children-first even though every FK is
-- ON DELETE CASCADE, so the statements read in dependency order rather than
-- relying on CASCADE to sort it out. `drop table … cascade` additionally takes
-- the table's own indexes, constraints, RLS policies, triggers and column
-- grants with it — those are therefore NOT listed individually below, but they
-- are enumerated in comments so the review can confirm nothing is missed.
--
-- Supersedes:
--   20260810120000_team_spaces.sql
--   20260810131500_team_plan_paths.sql
-- ════════════════════════════════════════════════════════════════════════════

begin;

-- ── 1. TRIGGERS ─────────────────────────────────────────────────────────────
-- Dropped explicitly first so the drop is legible; `drop table … cascade`
-- would remove them anyway.
--   team_spaces_immutable_trg      on public.team_spaces
--   team_spaces_seed_lead_trg      on public.team_spaces
--   team_space_members_guard_trg   on public.team_space_members
drop trigger if exists team_spaces_immutable_trg    on public.team_spaces;
drop trigger if exists team_spaces_seed_lead_trg    on public.team_spaces;
drop trigger if exists team_space_members_guard_trg on public.team_space_members;

-- ── 2. TABLES ───────────────────────────────────────────────────────────────
-- Each `cascade` also removes, for that table:
--
-- team_space_events
--   indexes:  team_space_events_space_at_idx, team_space_events_target_idx
--   check:    tse_action_chk
--   policy:   team_space_events_select
--   grants:   select (id, space_id, actor_id, action, target_user_id, at)
--             to authenticated
--   sequence: team_space_events_id_seq (owned by the bigserial pk)
drop table if exists public.team_space_events cascade;

-- team_space_plan_items
--   indexes:  team_space_plan_items_uniq_key, team_space_plan_items_space_idx
--   checks:   tspi_path_slug_shape_chk, tspi_due_on_range_chk
--             (both added by 20260810131500_team_plan_paths.sql)
--   policy:   team_space_plan_items_select
--   grants:   select (id, space_id, user_id, department_id, assigned_by,
--             assigned_at) + select (path_slug, due_on) to authenticated
drop table if exists public.team_space_plan_items cascade;

-- team_space_blocks
--   policies: team_space_blocks_select_own, team_space_blocks_insert_own,
--             team_space_blocks_delete_own
--   grants:   select (space_id, user_id, created_at),
--             insert (space_id, user_id), delete — to authenticated
drop table if exists public.team_space_blocks cascade;

-- team_invites
--   indexes:  team_invites_one_live_per_space_key (partial, revoked_at is null),
--             team_invites_space_idx
--   policy:   team_invites_select_lead
--   grants:   select (id, space_id, created_by, created_at, expires_at,
--             max_uses, uses, revoked_at) to authenticated
--             NOTE: the token column never had a grant to any client role.
drop table if exists public.team_invites cascade;

-- team_space_members
--   indexes:  team_space_members_one_lead_key,
--             team_space_members_one_active_per_user_key,
--             team_space_members_user_idx, team_space_members_space_status_idx
--   policies: team_space_members_select, team_space_members_delete_self
--   grants:   select (space_id, user_id, role, status, invited_by, invited_at,
--             joined_at) + delete — to authenticated
drop table if exists public.team_space_members cascade;

-- team_spaces
--   indexes:  team_spaces_program_number_key, team_spaces_one_per_owner_key
--   policy:   team_spaces_select_member
--   grants:   select (id, program, team_number, name, created_by, created_at)
--             to authenticated
--   comment:  table comment set in 20260810120000
drop table if exists public.team_spaces cascade;

-- ── 3. FUNCTIONS ────────────────────────────────────────────────────────────
-- The two trigger functions and the seed function are only reachable from the
-- triggers dropped above. The two RLS helpers were referenced only by policies
-- that went with their tables. redeem_team_invite was service_role-only and
-- was called from src/lib/team-space.ts, which no longer exists.
drop function if exists public.team_spaces_immutable();
drop function if exists public.team_spaces_seed_lead();
drop function if exists public.team_space_members_guard();
drop function if exists public.is_team_space_member(uuid);
drop function if exists public.is_team_space_lead(uuid);
drop function if exists public.redeem_team_invite(text, uuid);

-- ── NOT DROPPED, ON PURPOSE ─────────────────────────────────────────────────
-- profiles.team_number          — /teams is keyed off it and always was.
-- profiles.referred_by
-- profiles.referral_surface     — the ported invite still writes
--                                 referral_surface = 'team-invite'; see
--                                 src/lib/signup-attribution.ts.
-- public.team_courses / join-code tables (if present) — /join/[code] is a
--                                 different, older feature and is untouched.
-- No custom TYPE was ever created by the team-space migrations, so there is
-- nothing to drop in that category.

commit;
