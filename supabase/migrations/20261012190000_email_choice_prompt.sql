-- Ask existing members whether they want reminder emails (owner, 2026-10-12).
--
-- Until today every account was enrolled in reminder emails by default, and
-- the reminders go to lapsed learners, exactly the people who won't be on the
-- site to see a question. So "do you want them?" only means something if the
-- default enrolment stops first:
--
-- email_choice_at records when the member themselves said yes or no: the box
-- at signup, the switch in Settings, the one-time prompt, or an unsubscribe
-- link. The site shows the prompt to signed-in members while it's null, and
-- the reminder sender only mails rows that have it set.
alter table public.profiles add column if not exists email_choice_at timestamptz;

-- Everyone's setting as it stood before this change, so it can be undone.
-- Service-role only: RLS on, no policies.
create table if not exists public.profiles_email_opt_in_backup_20261012 as
  select id, email_opt_in, now() as backed_up_at from public.profiles;
alter table public.profiles_email_opt_in_backup_20261012 enable row level security;

-- Already off: almost all of these unsubscribed themselves. Count that as their
-- answer so they aren't asked again.
update public.profiles set email_choice_at = now()
  where email_opt_in = false and email_choice_at is null;

-- On only because of the old default: off until they answer the prompt.
update public.profiles set email_opt_in = false
  where email_opt_in = true and email_choice_at is null;
