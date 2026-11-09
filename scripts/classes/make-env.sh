#!/bin/bash
# Builds a classes package worktree's .env.local (classes-design.md 13.6).
#
#   scripts/classes/make-env.sh <worktree> <package> [port]
#
# = the main checkout's .env.local (the production Supabase URL and keys),
#   without RESEND_API_KEY and with the worktree overrides below,
# + every non-empty value in the main checkout's
#   .claude-scratch/classes-dev/keys.env (Cloudflare, R2, AI Gateway),
# + the worktree values from section 13.1. The dev outbox and the test
#   accounts folder are inside the worktree's own .claude-scratch/classes-dev
#   (git-ignored), so packages never write into each other's folders.
#
# Prints only the NAMES it wrote, never a value.

set -euo pipefail

if [ $# -lt 2 ]; then
  echo "usage: $0 <worktree> <package> [port]" >&2
  exit 2
fi

WORKTREE="$(cd "$1" && pwd)"
PACKAGE="$2"
PORT="${3:-3000}"
case "$PACKAGE" in
  *[!a-z0-9-]*|"") echo "package must be a-z, 0-9 and -" >&2; exit 2 ;;
esac
case "$PORT" in
  *[!0-9]*|"") echo "port must be a number" >&2; exit 2 ;;
esac

COMMON="$(git -C "$WORKTREE" rev-parse --path-format=absolute --git-common-dir)"
MAIN="$(dirname "$COMMON")"
SRC_ENV="$MAIN/.env.local"
KEYS="$MAIN/.claude-scratch/classes-dev/keys.env"
DEV="$WORKTREE/.claude-scratch/classes-dev"
OUT="$WORKTREE/.env.local"

if [ ! -f "$SRC_ENV" ]; then echo "no main .env.local at $SRC_ENV" >&2; exit 2; fi

# Names the worktree sets itself (or must never have).
OVERRIDDEN='^(RESEND_API_KEY|ADMIN_EMAILS|CRON_SECRET|NEXT_PUBLIC_SITE_URL|CLASSES_[A-Z_]*|EMAIL_DEV_OUTBOX|CLOUDFLARE_[A-Z_]*|R2_[A-Z_]*|AI_GATEWAY_API_KEY)='

TMP="$(mktemp "$WORKTREE/.env.local.XXXXXX")"
trap 'rm -f "$TMP"' EXIT
chmod 600 "$TMP"

{
  echo "# Written by scripts/classes/make-env.sh for package \"$PACKAGE\"."
  echo "# Production Supabase (the only database), the dev RealtimeKit app, no Resend."
  grep -Ev "$OVERRIDDEN" "$SRC_ENV" | grep -E '^[A-Za-z_][A-Za-z0-9_]*=' || true
  if [ -f "$KEYS" ]; then
    # Only keys with a value: an empty one would hide a "needs keys" check.
    grep -E '^[A-Za-z_][A-Za-z0-9_]*=' "$KEYS" | grep -Ev '^[A-Za-z_][A-Za-z0-9_]*=(""|'"''"')?[[:space:]]*$' || true
  fi
  echo "CLASSES_VISIBLE=1"
  echo "CLASSES_DEV_SWITCHES=1"
  echo "CLASSES_DEV_ALLOW_SOON=1"
  echo "EMAIL_DEV_OUTBOX=$DEV/outbox/$PACKAGE"
  echo "CLASSES_AUDIT_SALT=lftest-classes-audit-salt"
  echo "CLASSES_SAFETY_EMAIL=lftest-safety@example.com"
  echo "ADMIN_EMAILS=lftest+$PACKAGE-owner@example.com"
  echo "CRON_SECRET=lftest-cron-$PACKAGE"
  echo "NEXT_PUBLIC_SITE_URL=http://localhost:$PORT"
} > "$TMP"

mv "$TMP" "$OUT"
trap - EXIT
mkdir -p "$DEV/outbox/$PACKAGE" "$DEV/test-accounts"

echo "wrote $OUT with:"
grep -Eo '^[A-Za-z_][A-Za-z0-9_]*' "$OUT" | sort | tr '\n' ' '
echo
