-- The marketing tag: who has been accepted for the marketing role, the one
-- role /apply takes applications for.
--
-- WHY A TABLE OF ITS OWN, NOT A ROW IN `site_admins`. `site_admins` is the
-- admin gate. `getSiteRole` (src/lib/auth.ts) reads it to decide who opens
-- /admin, `getAdminTeam` (src/lib/admin-team.ts) lists every row in it as an
-- admin on /admin/team, and `setAdminRoleFor` can promote any row in it to
-- super admin. A marketer stored there, even under a new role word, would be
-- one loose `role !== "member"` check away from the admin panel. Nothing that
-- grants admin access ever reads this table, so being in it can't open /admin.
--
-- A marketer gets no site data from this row either. The only thing it unlocks
-- is the marketer card on /apply (their own invite link) and a line on the
-- super admin's /admin/team desk with how many people signed up through that
-- link (`profiles.referred_by`, the referral column the invite link already
-- writes).
--
-- Locked to the service role, like `site_admins` and `admin_applications`:
-- RLS is on with no policies, and every read and write goes through trusted
-- server code (src/lib/app/admin-apply-marketing.ts) that checks the caller's
-- role itself. Marketers' handles are never shown publicly.

create table if not exists public.marketers (
  user_id uuid primary key references auth.users(id) on delete cascade,
  granted_by uuid references auth.users(id) on delete set null,
  granted_at timestamptz not null default now(),
  -- The application that was accepted, kept for the record. Null if that
  -- application row is ever deleted.
  application_id uuid references public.admin_applications(id) on delete set null,
  note text
);

alter table public.marketers enable row level security;
revoke all on table public.marketers from anon, authenticated;
