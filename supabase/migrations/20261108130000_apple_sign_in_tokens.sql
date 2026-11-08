-- Sign in with Apple: the refresh tokens account deletion revokes.
--
-- Apple requires an app that offers Sign in with Apple and lets people delete
-- their account to revoke that person's Apple tokens when they do (App Store
-- guideline 5.1.1(v), POST https://appleid.apple.com/auth/revoke). Revoking
-- takes a refresh token, and Apple only hands one out at sign-in, so one is
-- kept per account and Apple client:
--
--   client_id = the Services ID   for the website (Supabase passes Apple's
--                                  refresh token back to /auth/callback)
--   client_id = the app bundle id for the iPhone, iPad and Mac app (the app's
--                                  authorization code is traded for one in
--                                  POST /api/app/auth/oauth-complete)
--
-- Written and read only by src/lib/app/apple-sign-in.ts with the service role.
-- No API role can touch it: RLS is on with no policies, and the grants are
-- revoked as well. Rows go with the auth user (on delete cascade), after
-- deleteAccountData has used them to revoke.
--
-- Additive: nothing reads this table until an account has an Apple identity.

create table if not exists public.apple_sign_in_tokens (
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id text not null,
  refresh_token text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, client_id)
);

alter table public.apple_sign_in_tokens enable row level security;
revoke all on table public.apple_sign_in_tokens from anon, authenticated;

comment on table public.apple_sign_in_tokens is
  'Sign in with Apple refresh tokens, kept only to revoke them when the account is deleted. Service role only.';
