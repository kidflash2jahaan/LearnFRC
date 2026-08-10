"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  clearMigratedGuestLessons,
  flushPendingGuestProgress,
  getVisitorId,
  readGuestLessons,
  recoverUnmigratedGuestLessons,
} from "@/lib/guest-progress";

/** Per-tab guard: at most one migration attempt per session, so this doesn't
 *  fire a request on every client-side navigation. */
const ONCE_KEY = "lf_guest_migrated";

const LOG = "[guest-migration]";

type MigrateResult = {
  /** Rows inserted by THIS call. */
  migrated: number;
  xp: number;
  /** The lesson ids behind `migrated` — the only ids this call proves are in
   *  the account, and so the only ones it is safe to delete locally. */
  lessonIds: string[];
};

/** Returns null for every "we don't actually know what happened" outcome —
 *  offline, non-2xx, unreadable body. Callers must treat null as "change
 *  nothing locally", because the local copy may be the last one. */
async function migrate(visitorId: string): Promise<MigrateResult | null> {
  let r: Response;
  try {
    r = await fetch("/api/migrate-guest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visitorId }),
    });
  } catch (err) {
    console.warn(
      `${LOG} request failed (offline?). Keeping this browser's progress and retrying next session.`,
      err
    );
    return null;
  }
  if (!r.ok) {
    let detail = "";
    try {
      detail = (await r.text()).slice(0, 200);
    } catch {
      /* body already consumed or unreadable */
    }
    console.warn(
      `${LOG} server returned HTTP ${r.status}${
        r.status === 429 ? " (rate limited)" : ""
      }. Keeping this browser's progress and retrying next session.`,
      detail
    );
    return null;
  }
  try {
    const d = (await r.json()) as Partial<MigrateResult>;
    return {
      migrated: typeof d.migrated === "number" ? d.migrated : 0,
      xp: typeof d.xp === "number" ? d.xp : 0,
      lessonIds: Array.isArray(d.lessonIds)
        ? d.lessonIds.filter((x): x is string => typeof x === "string")
        : [],
    };
  } catch (err) {
    console.warn(
      `${LOG} could not read the migration response. Keeping this browser's progress.`,
      err
    );
    return null;
  }
}

/** The lessons the ACCOUNT holds, or null if we could not find out. Used as the
 *  second source of truth: /api/migrate-guest only reports rows it INSERTED, so
 *  a lesson the account already had (an earlier partial migration, or one
 *  finished after signing in) is safe to clear even though it isn't in
 *  `lessonIds`. Null means "unknown", which means keep everything. */
async function fetchAccountLessons(): Promise<Set<string> | null> {
  try {
    const r = await fetch("/api/me/progress", {
      headers: { accept: "application/json" },
    });
    if (!r.ok) return null;
    const d = (await r.json()) as {
      authed?: boolean;
      completedLessonIds?: unknown;
    };
    if (!d.authed || !Array.isArray(d.completedLessonIds)) return null;
    return new Set(
      d.completedLessonIds.filter((x): x is string => typeof x === "string")
    );
  } catch {
    return null;
  }
}

/**
 * Runs once for a signed-in reader: anything they completed on this device
 * BEFORE they had an account is moved into the account.
 *
 * Why it is mounted in <MyProgressProvider> (every guides page) and not only on
 * /dashboard: every guest-facing signup CTA passes `?next=<lessonPath>`, and
 * both auth routes honour `next`, so a guest who signs up from a lesson lands
 * back on the LESSON — never on the dashboard. With the dashboard as the only
 * mount, migration never ran for exactly the readers it exists for. Measured:
 * all 67 guest rows across 27 visitors survived an 18-day window, i.e. zero
 * migrations had ever completed, while the ask promised "keep your progress".
 *
 * Order matters: flush the retry queue first so a completion that never reached
 * the server still gets there, THEN migrate — otherwise the very lessons the
 * queue exists to protect would be the ones left behind.
 *
 * NOTHING LOCAL IS DELETED WITHOUT PROOF. The previous version ran
 * `if (migrated > 0 || hadLocal) clearGuestLessons()`, so a response of
 * `migrated: 0` — the server holds no guest rows for this visitor — still wiped
 * the browser's completions. A lesson whose server row was missing (older code
 * path, or a POST that never landed) was destroyed at the exact moment the
 * reader signed up to keep it. Now each id must be shown to be in the account
 * before it is cleared; the rest is kept, re-posted so a later pass can carry
 * it, and reported in the console.
 */
export function GuestMigration({ enabled = true }: { enabled?: boolean }) {
  const router = useRouter();
  const ran = useRef(false);

  useEffect(() => {
    if (!enabled || ran.current) return;
    ran.current = true;

    let cancelled = false;
    (async () => {
      try {
        if (sessionStorage.getItem(ONCE_KEY)) return;
      } catch {
        /* storage blocked — fall through and just try once per mount */
      }

      const visitorId = getVisitorId();
      if (!visitorId) return;

      // Rejections are kept here rather than deleted: at signup the local copy
      // can be the only surviving record that the reader did the lesson.
      await flushPendingGuestProgress({ keepRejected: true });
      if (cancelled) return;

      const res = await migrate(visitorId);
      // Unknown outcome — leave every local completion exactly where it is and
      // let the next session try again. Deliberately does NOT set ONCE_KEY.
      if (cancelled || !res) return;

      try {
        sessionStorage.setItem(ONCE_KEY, "1");
      } catch {
        /* ignore */
      }

      let migrated = res.migrated;
      let xp = res.xp;
      // Proven to be in the account, and therefore safe to drop locally.
      const owned = new Set(res.lessonIds);

      // Nothing in this browser means nothing to reconcile: the common case (a
      // returning signed-in reader) still costs one cheap request per tab.
      const local = readGuestLessons();
      if (local.size) {
        let remainder = [...local].filter((id) => !owned.has(id));

        // The route only reports rows it inserted. Ask the account about the
        // rest before assuming they are lost.
        if (remainder.length) {
          const account = await fetchAccountLessons();
          if (cancelled) return;
          if (account) {
            for (const id of account) owned.add(id);
            remainder = remainder.filter((id) => !account.has(id));
          } else {
            console.warn(
              `${LOG} could not read the account's lessons; keeping every unconfirmed local completion.`
            );
          }
        }

        // Still unaccounted for: the server has no record that this reader did
        // these lessons. Re-post them so a second pass can carry them.
        if (remainder.length) {
          console.warn(
            `${LOG} ${remainder.length} completion(s) in this browser are not in the account after migrating. Keeping them and trying to re-save: ${remainder.join(", ")}`
          );
          const { requeued, blocked, deferred } =
            await recoverUnmigratedGuestLessons(remainder);
          if (cancelled) return;
          if (blocked.length)
            console.warn(
              `${LOG} the server refused ${blocked.length} of them (unverified quiz or unknown lesson). Kept in this browser, not migrated: ${blocked.join(", ")}`
            );
          if (deferred.length)
            console.warn(
              `${LOG} ${deferred.length} not retried this session (offline or out of attempts). Kept in this browser: ${deferred.join(", ")}`
            );
          if (requeued.length) {
            console.warn(
              `${LOG} re-saved ${requeued.length} to the server; running a second migration pass.`
            );
            const second = await migrate(visitorId);
            if (cancelled) return;
            if (second) {
              migrated += second.migrated;
              xp += second.xp;
              for (const id of second.lessonIds) owned.add(id);
            }
          }
        }

        const kept = clearMigratedGuestLessons(owned);
        if (kept.length)
          console.warn(
            `${LOG} kept ${kept.length} completion(s) in this browser rather than deleting them — the account does not have them yet: ${kept.join(", ")}`
          );
      }

      if (migrated > 0) {
        toast.success(
          `${migrated} lesson${migrated === 1 ? "" : "s"} you finished before signing up ${
            migrated === 1 ? "is" : "are"
          } now saved to your account${xp ? ` — +${xp} XP` : ""}.`
        );
        router.refresh();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled, router]);

  return null;
}
