-- ════════════════════════════════════════════════════════════════════════════
-- TRAINING PLANS — additive extension of team_space_plan_items.
--
-- Companion to 20260810120000_team_spaces.sql. Everything here is ADDITIVE:
-- two nullable columns and one index repair. No existing column, policy, grant
-- or trigger is altered, so src/lib/team-space.ts (which lists its columns
-- explicitly and never does select('*')) is unaffected.
--
-- WHY THESE TWO COLUMNS AND NOTHING ELSE
-- The base table stores a plan as a bag of department ids. That is the right
-- payload, but it loses two things the product needs and neither of them is a
-- free-text channel from an adult to a minor:
--
--   path_slug  A key into the FIXED, code-defined catalog in src/lib/paths-data
--              (5 curated routes). It is a slug, never a name a lead typed, and
--              the CHECK below makes a sentence physically unrepresentable —
--              no spaces, no punctuation beyond a hyphen, 64 chars max. It
--              exists so "Team 447 suggested the New Member Onboarding route"
--              can be rendered instead of five unexplained department chips.
--
--   due_on     A DATE. Not a timestamp, not a string, not a reason. A date
--              cannot carry a message. It is rendered everywhere as a team
--              TARGET, never as a deadline, and passing it changes nothing:
--              no lock, no notification, no colour change, no effect on
--              progress or XP. See the copy in src/components/team/plan-*.tsx.
--
-- Deliberately still absent, and must stay absent: title, note, description,
-- reason, "assigned by <name>", priority, and any per-item text of any kind.
-- ════════════════════════════════════════════════════════════════════════════

alter table public.team_space_plan_items
  add column if not exists path_slug text,
  add column if not exists due_on    date;

-- Structural proof that path_slug cannot become a message. Lowercase slug
-- shape only; the server additionally rejects anything not in PATHS.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'tspi_path_slug_shape_chk'
  ) then
    alter table public.team_space_plan_items
      add constraint tspi_path_slug_shape_chk
      check (path_slug is null or path_slug ~ '^[a-z][a-z0-9-]{0,63}$');
  end if;

  -- Loose sanity bound only. The real window (today … today + 180 days) is
  -- enforced in the server action, because "reasonable" is a product question
  -- and a migration should not need editing when it changes.
  if not exists (
    select 1 from pg_constraint where conname = 'tspi_due_on_range_chk'
  ) then
    alter table public.team_space_plan_items
      add constraint tspi_due_on_range_chk
      check (due_on is null or (due_on >= date '2026-01-01' and due_on <= date '2035-12-31'));
  end if;
end $$;

-- Parity with the existing column-scoped grant: an ACTIVE member of the space
-- may read the plan (policy team_space_plan_items_select already scopes it).
-- Writes remain server-role-only — there is still no insert/update/delete
-- grant or policy on this table for any client role.
grant select (path_slug, due_on) on public.team_space_plan_items to authenticated;

-- ── index repair ────────────────────────────────────────────────────────────
-- The original dedupe index was an EXPRESSION index:
--   (space_id, coalesce(user_id, '000…0'::uuid), department_id)
-- Postgres infers an ON CONFLICT arbiter from the *columns* written in the
-- statement, and an expression index is not inferable from a bare column list.
-- PostgREST/supabase-js can only emit a column list, so
-- `.upsert(..., { onConflict: "space_id,user_id,department_id" })` — which is
-- exactly what setPlanItem() in src/lib/team-space.ts emits — raises
--   42P10: there is no unique or exclusion constraint matching the ON CONFLICT
--          specification
-- on EVERY call, making that function a guaranteed server_error. Verified
-- against this database on a temp-table replica of the index.
--
-- The fix is the same semantics expressed so the planner can infer it. This
-- database is PostgreSQL 17, so NULLS NOT DISTINCT is available and treats two
-- whole-space rows (user_id IS NULL) as duplicates exactly like the coalesce()
-- form did. Identical constraint, same name, now inferable.
drop index if exists public.team_space_plan_items_uniq_key;
create unique index if not exists team_space_plan_items_uniq_key
  on public.team_space_plan_items (space_id, user_id, department_id)
  nulls not distinct;
