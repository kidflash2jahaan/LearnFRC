import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Unsubscribe · LearnFRC",
  robots: { index: false, follow: false },
};

/**
 * One-click unsubscribe from lifecycle email (CAN-SPAM). Token-gated, no login.
 * Idempotent: sets email_opt_in=false for the matching profile. `resub=1`
 * re-enables it, so an accidental click is reversible.
 *
 * LAYOUT: a stamped receipt, and nothing else. This page is reached from a
 * link in an email by somebody who wants one fact confirmed and then wants to
 * leave, so it is a single taped card in the middle of the paper: what this
 * was, what just happened, the setting's new state in mono, and one way back.
 * The whole page is the card, which is why nothing else on the site looks like
 * this one.
 *
 * There is no green tick and no red cross. The palette has neither colour, and
 * the sentence already says which of the two happened; the state line under
 * the rule says it again in a form that survives a greyscale printout.
 */
export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; resub?: string }>;
}) {
  const { token, resub } = await searchParams;
  const optIn = resub === "1";
  let ok = false;

  if (token && /^[0-9a-f-]{36}$/i.test(token)) {
    const admin = createAdminClient();
    const { data } = await admin
      .from("profiles")
      .update({ email_opt_in: optIn })
      .eq("unsubscribe_token", token)
      .select("id")
      .maybeSingle();
    ok = !!data;
  }

  return (
    <div className="nb-wrap flex min-h-[70dvh] max-w-[36rem] flex-col justify-center py-[clamp(2.5rem,6vw,4rem)]">
      {ok ? (
        <div className="nb-box nb-tilt-1 p-[clamp(1.3rem,3vw,2rem)]">
          <span
            className="nb-tape -top-3 left-[22%] rotate-[-3.4deg]"
            aria-hidden="true"
          />
          <span
            className="nb-tape -bottom-3 right-[18%] rotate-[2.5deg]"
            aria-hidden="true"
          />
          <p className="nb-slug">learnfrc / learning reminders</p>
          <h1 className="mt-3 text-[clamp(1.75rem,1.3rem+1.6vw,2.4rem)]">
            {optIn ? "You're back on the list." : "You're off the list."}
          </h1>
          <p className="mt-4 text-[0.99rem] leading-relaxed text-graphite">
            {optIn
              ? "Learning reminders will start again: your next lesson, and a nudge when a streak is about to end. You can turn them off again from any of those emails, or in your settings."
              : "No more learning reminders will be sent to this address. Your account, your progress and your certificates are untouched, and you can still read every lesson."}
          </p>

          <div className="nb-hair mt-6 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 pt-4">
            <p className="nb-slug">learning reminders</p>
            <p className="nb-count text-[1.15rem]">{optIn ? "on" : "off"}</p>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/" className="nb-btn">
              Back to LearnFRC
            </Link>
            {!optIn && token && (
              <Link
                href={`/unsubscribe?token=${token}&resub=1`}
                className="nb-btn-ghost"
              >
                Undo, put me back on
              </Link>
            )}
          </div>
        </div>
      ) : (
        <div className="nb-box border-[3px] p-[clamp(1.3rem,3vw,2rem)]">
          <p className="nb-slug">learnfrc / link rejected</p>
          <h1 className="mt-3 text-[clamp(1.75rem,1.3rem+1.6vw,2.4rem)]">
            This link didn&rsquo;t match anything.
          </h1>
          <p className="mt-4 text-[0.99rem] leading-relaxed text-graphite">
            It is either expired or was copied incompletely, so nothing was
            changed. Email preferences live in your account settings, and you
            can switch reminders off there in one click.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/settings" className="nb-btn">
              Open settings
            </Link>
            <Link href="/contact" className="nb-btn-ghost">
              Ask for help instead
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
