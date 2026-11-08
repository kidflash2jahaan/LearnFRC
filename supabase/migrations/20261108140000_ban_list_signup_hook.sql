-- The ban list at every door that makes an account.
--
-- The site's ban (the report desk's "Ban the account" and the progress scan)
-- puts the email on public.banned_emails and deletes the account. The sign-up
-- form checks that list (registerAccount, src/lib/app/accounts.ts), and so
-- does completeOAuthSignIn for a brand-new Google or Apple account, which it
-- deletes again on a hit. Neither covers someone who calls Supabase Auth
-- directly with the public anon key (/auth/v1/signup, or an ID-token sign-in
-- that never reaches /api/app/auth/oauth-complete). This hook does: Supabase
-- runs it before it creates any user, by email, Google or Apple, and it
-- refuses an email on the ban list before the account exists.
--
-- The message is BANNED_SIGNUP in src/lib/app/accounts.ts, word for word:
-- /auth/callback matches it to show the sign-in page's ban notice. 400 rather
-- than 403, so the app shows the sentence instead of treating it as a
-- signed-out session.
--
-- Banned IPs stay with the server's checks. For a sign-up made through
-- learnfrc.com's own server, the IP Supabase sees here is the server's, not
-- the person's.
--
-- SWITCHING IT ON. This migration only creates the function. After applying
-- it, register it in the Supabase dashboard: Authentication, Auth Hooks, "Before
-- User Created", type Postgres, function public.hook_before_user_created. Until
-- then nothing calls it and nothing changes.
--
-- Additive: one new function, a schema usage grant and a read-only grant and
-- policy for the auth server's own role on banned_emails. No new tables, and
-- no API role (anon, authenticated) gains anything.

create or replace function public.hook_before_user_created(event jsonb)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  address text := lower(trim(coalesce(event -> 'user' ->> 'email', '')));
begin
  if address <> '' and exists (
    select 1 from public.banned_emails b where lower(b.email) = address
  ) then
    return jsonb_build_object(
      'error', jsonb_build_object(
        'http_code', 400,
        'message', 'This account can''t be created. If you believe this is a mistake, contact support.'
      )
    );
  end if;
  return '{}'::jsonb;
end;
$$;

comment on function public.hook_before_user_created(jsonb) is
  'Supabase Auth "Before User Created" hook: refuses an email on public.banned_emails. Register it under Auth Hooks to switch it on.';

-- Only the auth server may run it.
grant usage on schema public to supabase_auth_admin;
grant execute on function public.hook_before_user_created(jsonb) to supabase_auth_admin;
revoke execute on function public.hook_before_user_created(jsonb) from authenticated, anon, public;

-- The hook runs as supabase_auth_admin, which needs to read the ban list.
-- RLS stays on; this policy lets that one role read it and nothing else.
grant select on table public.banned_emails to supabase_auth_admin;

drop policy if exists banned_emails_auth_hook_read on public.banned_emails;
create policy banned_emails_auth_hook_read on public.banned_emails
  as permissive
  for select
  to supabase_auth_admin
  using (true);
