import type { FunnelStep } from "@/lib/funnel";
import { getVisitorId } from "@/lib/guest-progress";

/**
 * ACTIVATION-FUNNEL BEACON — the browser half.
 *
 * src/lib/funnel.ts is `server-only`; this is the piece the client is allowed to
 * hold. It exists because the two steps the funnel was built to answer —
 * "opened a lesson" and "attempted a quiz" — leave NO trace in the schema.
 * Nothing in page_views carries a user id, and quiz grading is pure client
 * state, so until this file had a caller those rows were a floor (= everyone who
 * finished a lesson) rather than a measurement, and the 45% who never complete
 * anything were invisible between signup and completion.
 *
 * Contract, matching /api/funnel-event and the funnel_events migration:
 *  - the body is `{ step, visitorId }` and nothing else. No path, no lesson id,
 *    no timing, no user id — the SERVER decides the subject from the session
 *    cookie, so a forged body cannot write into someone else's funnel.
 *  - every step is once-per-subject-for-all-time (partial unique indexes), so
 *    a repeat POST is a 23505 no-op. Callers never need their own "have I sent
 *    this?" state, and the session memory below is a courtesy to the rate
 *    limiter, not a correctness requirement.
 *  - fire-and-forget: nothing here is awaited by a caller, nothing blocks a
 *    render or a click, and no failure is ever shown to a reader.
 */

/**
 * The steps a BROWSER is allowed to report.
 *
 * Deliberately a subset. `signup` and the signed-in completions are recorded
 * server-side where they are facts rather than claims (see
 * src/app/actions/progress.ts), and `return_visit` is decided in
 * /api/presence from the stored last_seen_at rather than from a client clock.
 * What is left is the two steps only the browser can see, plus the guest
 * completions — a logged-out reader has no profile row, so if the browser does
 * not report those the anonymous column of the funnel shows opens and quiz
 * attempts that never once turn into a completion, which is false.
 *
 * `Extract` rather than a hand-written union so a typo, or a step being renamed
 * in FUNNEL_STEPS, fails the build here instead of being silently rejected by
 * the route's allow-list at runtime. It is a TYPE-only import, erased at
 * compile time, so the `server-only` guard in funnel.ts is never bundled.
 */
export type ClientFunnelStep = Extract<
  FunnelStep,
  | "lesson_opened"
  | "quiz_attempted"
  | "lesson_completed"
  | "second_lesson_completed"
>;

const ENDPOINT = "/api/funnel-event";

/**
 * Steps already accepted in this JS session.
 *
 * In MEMORY, deliberately not localStorage. A persisted "already sent" flag
 * would survive the moment a reader signs up — at which point the subject
 * changes from the anonymous lf_vid to their account id and every step needs to
 * be recorded again, against the new subject. A guest who opened a lesson, made
 * an account and opened another would then never register as an opener, and the
 * step this whole module exists to measure would under-count exactly the people
 * it is watching. Session scope kills React's double-mount and repeat
 * client-side navigations (the bulk of the duplicate traffic) and forgets
 * everything on the next hard load, which is where a login boundary lands.
 */
const acknowledged = new Set<ClientFunnelStep>();

/**
 * Report one funnel milestone. Never throws, never rejects, never returns a
 * promise a caller could accidentally await into their critical path.
 */
export function sendFunnelEvent(step: ClientFunnelStep): void {
  if (typeof window === "undefined") return;
  if (acknowledged.has(step)) return;
  // Claimed up front so a double-render cannot send twice; released again below
  // if the request is lost, so a later trigger gets another go.
  acknowledged.add(step);

  // Same anonymous id as the pageview beacon and guest progress. Empty when
  // storage is blocked; the route then falls back to the session, and 400s only
  // for a reader who is both logged out AND storage-blocked — genuinely
  // unattributable, and worth a console line rather than silence.
  const visitorId = getVisitorId() || null;
  const body = JSON.stringify({ step, visitorId });

  const lost = (reason: string) => {
    acknowledged.delete(step);
    // Instrumentation must not surface to the reader — but it must not vanish
    // either. A funnel that quietly stops recording looks exactly like a funnel
    // where nobody converts, which is the failure mode this file was written to
    // end.
    console.error("[funnel] beacon lost:", step, reason);
  };

  try {
    // keepalive fetch FIRST, unlike page-view-beacon.tsx, which leads with
    // sendBeacon. Both survive an unload, but sendBeacon reports only "queued"
    // and can never tell us the server said no. These fire on mount and on
    // click rather than during unload, so the ordering costs nothing and buys
    // the visibility the paragraph above depends on.
    fetch(ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
      keepalive: true,
    })
      .then((res) => {
        // 204 is the only success, and it is also what a rate-limited request
        // returns — the endpoint drops those on purpose and there is nothing
        // useful a client can do about it.
        if (!res.ok) lost(`HTTP ${res.status}`);
      })
      .catch((err: unknown) => {
        // Network fault, or an unload that cut the request short. sendBeacon is
        // the one transport a browser promises to finish, so it gets the last
        // word before we call the event lost.
        let queued = false;
        try {
          queued = !!navigator.sendBeacon?.(
            ENDPOINT,
            new Blob([body], { type: "application/json" })
          );
        } catch {
          queued = false;
        }
        if (!queued) lost((err as Error)?.message || "network error");
      });
  } catch (err) {
    lost((err as Error)?.message || "fetch threw");
  }
}
