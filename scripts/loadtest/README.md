# Sign-in load test

`sign-in.mjs` signs one throwaway account in, over and over, at a slow fixed rate, against a preview deployment. It prints how long each sign-in took and what came back, then a summary. It's for checking that sign-in holds up before a launch, not for finding the breaking point.

Nothing runs it automatically. There's no npm script, cron job or CI step for it, and it hasn't been run against any deployment yet.

## What it hits

`POST /api/app/auth/sign-in` with `{ "identifier", "password" }`, the route the iPhone, iPad and Mac app signs in through. It runs the same sign-in code as the website's login form (`resolveSignInEmail` in `src/lib/app/accounts.ts`, then Supabase's password check), and it takes plain JSON. The website's own form is a server action, which a script can't call cleanly.

It doesn't load pages, sign up, or touch any other route.

## Before you run it

1. **Use a preview deployment, never production.** The script refuses `learnfrc.com`, `www.learnfrc.com`, the old `learnfrc.systemerr.com` hosts and `learnfrc.vercel.app`. Treat any other alias that serves production the same way.
2. **Check which Supabase project the preview talks to.** Unless Vercel's Preview environment variables point at a separate project, a preview uses the production database and production Supabase Auth. Then:
   - every sign-in in the test is a real sign-in on the production auth server, and
   - the requests reach Supabase from Vercel's servers, so they count against Supabase's per-IP sign-in limit for those servers, which real visitors' sign-ins also pass through.

   So keep it short and slow, run it at a quiet time (late evening Pacific), and stop it (Ctrl-C) if real sign-ins might be affected.
3. **Make a throwaway account.** Never use a real person's account. Create it with the Supabase Auth admin API, already confirmed so no email is sent:

   ```sh
   curl -X POST "$SUPABASE_URL/auth/v1/admin/users" \
     -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
     -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
     -H "Content-Type: application/json" \
     -d '{"email":"loadtest-1208@example.com","password":"<a long random password>","email_confirm":true}'
   ```

   Keep the user id it returns, so you can delete the account afterwards.
4. **If the preview is behind Vercel Deployment Protection**, set `VERCEL_AUTOMATION_BYPASS_SECRET` to the project's protection bypass secret. The script sends it as `x-vercel-protection-bypass`.

## Running it

Credentials come from the environment only, never from flags, so they don't end up in shell history or `ps`.

```sh
export LOADTEST_URL="https://learnfrc-git-release-10-<team>.vercel.app"
export LOADTEST_IDENTIFIER="loadtest-1208@example.com"   # email or username
export LOADTEST_PASSWORD="<the throwaway account's password>"

# See the plan without sending anything:
node scripts/loadtest/sign-in.mjs --dry-run

# The default: 1.5 sign-ins a minute for 10 minutes (15 in all).
node scripts/loadtest/sign-in.mjs

# A little more, for 5 minutes:
node scripts/loadtest/sign-in.mjs --per-minute 2 --minutes 5
```

| Option | Default | What it does |
| --- | --- | --- |
| `--url <url>` | `LOADTEST_URL` | The preview's base URL |
| `--per-minute <n>` | 1.5 | Sign-ins per minute. Capped at 60. |
| `--minutes <n>` | 10 | How long to run. Capped at 60. |
| `--max-in-flight <n>` | 4 | Most requests waiting at once |
| `--no-backoff` | off | Keep sending through a 429 instead of pausing for its `Retry-After` |
| `--dry-run` | off | Print the plan and exit |

Requests go out on a fixed schedule, so a slow server doesn't quietly lower the rate. If it falls behind (a 429 pause, or four requests still waiting), it starts the spacing again instead of catching up in a burst.

## Why the default is so low

The route has its own limits on top of Supabase's (see `src/app/api/app/auth/sign-in/route.ts`): 30 sign-ins per 5 minutes per network, and 10 per 5 minutes per account. With one account, anything above 2 a minute mostly measures the site's own 429s. The default of 1.5 a minute stays under both.

To push harder you'd need several throwaway accounts and several networks, and at that point it's worth talking about raising the limits first, since the per-network one probably counts Vercel's servers rather than each school.

## Reading the output

Each line is one sign-in: time, request number, HTTP status, milliseconds, and the error `code` from the response (`ok` on success). Session tokens in a successful response are never printed.

- `200 ok`: signed in.
- `429 rate_limited`: the site's limit or Supabase's. By default the script pauses for the `Retry-After` the response gives, up to 10 minutes.
- `401 unauthorized`: wrong identifier or password. Check the environment variables.
- `5xx`, `timeout` (15 s) or `network`: something is actually wrong. After 5 of these in a row the script stops on its own.

The summary counts each status and code, and gives p50, p90 and p99 latency for successful sign-ins. The exit code is 2 if any request got a server error or no response, otherwise 0.

## Afterwards

- Delete the throwaway account, which also ends every session the test created:

  ```sh
  curl -X DELETE "$SUPABASE_URL/auth/v1/admin/users/<user id>" \
    -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
    -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
  ```

- Look at Supabase's auth logs and Vercel's function logs for the window you ran it in. A `[middleware] sign-in check passed 1500 ms` warning means the sign-in check on page loads gave up and let pages through signed out, which is the timeout in `src/middleware.ts` doing its job, and also a sign Supabase was slow.
