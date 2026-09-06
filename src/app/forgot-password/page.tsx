import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { ForgotForm } from "./_forgot-form";

export const metadata: Metadata = {
  title: "Reset your password",
  description: "Forgot your LearnFRC password? Get a reset link by email.",
  robots: { index: false, follow: true },
};

/**
 * The three ways this goes wrong, in the order they actually happen.
 *
 * The third one is the reason this strip exists at all. An account created with
 * Continue with Google has no password, so no amount of resending produces a
 * link that works, and the old page had nothing anywhere on it that said so.
 * Somebody in that position could sit on this form all afternoon.
 */
const SNAGS = [
  {
    title: "It hasn't turned up",
    body: "Mail is queued, not instant. Give it a couple of minutes, then search your inbox for LearnFRC rather than scrolling, because a new message doesn't always land at the top.",
  },
  {
    title: "The link says expired",
    body: "Links last an hour and open once. If you asked twice, only the newest one works. Come back here and send another, the dead one stays dead.",
  },
  {
    title: "You signed up with Google",
    body: "Then there's no password on the account to reset and no email is coming. Use Continue with Google on the sign-in sheet and you're in.",
  },
] as const;

/**
 * RESET YOUR PASSWORD — a request slip, and the reasons it does not arrive.
 *
 * One field. The page has exactly one job and the form is most of it, so the
 * form is printed straight onto the paper under a heavy rule rather than being
 * put on a taped sheet: a card around a single input is ceremony around a
 * thirty-second errand.
 *
 * What earns the rest of the page is the part that used to be missing. Once you
 * press send there is nothing to do but wait, and every question you have from
 * that moment on is about mail that has not shown up. So the second half is a
 * drawn frame split into three panels, one per failure, written in the order
 * they occur to you. That composition appears nowhere else in this half of the
 * site, which is the point: /login is a split spread, /signup is three stacked
 * bands, this is a slip and a strip.
 *
 * BEHAVIOUR IS UNCHANGED: same session redirect, same `email` search param
 * handed to the form as its default value, same metadata, same server action
 * behind the form.
 */
export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email } = await searchParams;
  const { user } = await getSession();
  if (user) redirect("/dashboard");

  return (
    <>
      {/* ── The slip ────────────────────────────────────────────────── */}
      <section className="nb-wrap pt-[clamp(2.4rem,5vw,4.2rem)] pb-[clamp(2.2rem,4.5vw,3.4rem)]">
        <p className="nb-marker">locked out</p>
        <h1 className="max-w-[15ch]">Mail yourself a way back in.</h1>
        <p className="nb-lede mt-[clamp(0.9rem,2vw,1.3rem)]">
          One field, and a link that signs you in for long enough to pick a new
          password. Your progress, certificates and team all stay exactly where
          they are.
        </p>

        <div className="relative mt-[clamp(1.6rem,3.5vw,2.4rem)] max-w-[27rem] border-t-2 border-ink pt-[clamp(1.2rem,2.6vw,1.8rem)]">
          <ForgotForm defaultEmail={email} />

          {/* Pinned out in the margin where there is room for it, tucked
              underneath when there is not. */}
          <p className="nb-pen mt-6 max-w-[24ch] rotate-[-1.3deg] xl:absolute xl:left-[calc(100%+2.8rem)] xl:top-2 xl:mt-0">
            you can send this to yourself from the shop laptop and open it on
            your phone
          </p>
        </div>
      </section>

      {/* ── The strip: what goes wrong after you press send ──────────── */}
      <section className="nb-rule">
        <div className="nb-wrap py-[clamp(2.4rem,5vw,4rem)]">
          <h2 className="max-w-[20ch]">Nothing in the inbox?</h2>
          <p className="nb-sub mt-3">
            Work down these three. The last one is the one that catches people
            out, and no amount of resending fixes it.
          </p>

          <div className="nb-box mt-[clamp(1.4rem,3vw,2.2rem)] grid overflow-hidden grid-cols-[1.08fr_1fr_0.94fr] max-[860px]:grid-cols-1">
            {SNAGS.map((snag, i) => (
              <div className="nb-panel" key={snag.title}>
                <span
                  className="nb-box-sm mb-4 grid h-11 w-11 flex-none rotate-[-2deg] place-items-center border-blue font-mono text-[1.05rem] font-bold text-blue"
                  aria-hidden="true"
                >
                  {i + 1}
                </span>
                <h3 className="max-w-[16ch]">{snag.title}</h3>
                <p className="mt-2.5 text-[0.95rem] leading-snug text-graphite">
                  {snag.body}
                </p>
              </div>
            ))}
          </div>

          <p className="mt-[clamp(1.4rem,3vw,2rem)]">
            <Link href="/login" className="nb-btn-ghost">
              Back to the sign-in sheet
            </Link>
          </p>
        </div>
      </section>
    </>
  );
}
