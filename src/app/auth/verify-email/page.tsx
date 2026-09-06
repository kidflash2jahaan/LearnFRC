import type { Metadata } from "next";
import Link from "next/link";
import { ResendButton } from "@/components/auth/resend-button";
import { Postmark } from "./_signal-beacon";

export const metadata: Metadata = {
  title: "Verify your email",
  robots: { index: false },
};

/**
 * Three checks, in the order they occur to somebody staring at an empty inbox.
 * They are written as instructions rather than as reassurance, because a person
 * on this page is stuck and a soothing paragraph does not unstick them.
 */
const CHECKS = [
  {
    slug: "wait",
    text: "Mail is queued, not instant. A minute or two is normal, and refreshing the inbox does not make it faster.",
  },
  {
    slug: "search",
    text: "Search your mail for LearnFRC instead of scrolling. New mail does not always sort to the top, especially on a school account.",
  },
  {
    slug: "spam",
    text: "Then check spam and any Promotions tab. A first message from an address you have never written to is exactly what those filters are for.",
  },
] as const;

/**
 * VERIFY YOUR EMAIL — the page whose whole content is an address.
 *
 * Nothing happens here. The account is made, the link is sent, and every action
 * that matters is in another application. So the page does the one thing it is
 * uniquely able to do, which is show you WHICH address the link went to, at a
 * size you can check from arm's length. A mistyped address is the failure this
 * page exists to catch and the old design buried it in a sentence, under a
 * pulsing badge, a progress bar reading "Step 3 of 4", a three-step rail and
 * three counters spinning up to numbers about the catalogue.
 *
 * So the address gets the slab: the one inverted surface in the system, used
 * here the way /signup uses it, to carry the single fact that has to read from
 * across the room. Everything after it is troubleshooting, because that is the
 * only thing left to say.
 *
 * BEHAVIOUR IS UNCHANGED: same `email` search param, same resend action behind
 * the same button, still only rendered when there is an address to resend to,
 * same metadata, same links out.
 */
export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email } = await searchParams;

  return (
    <>
      {/* ── The instruction ─────────────────────────────────────────── */}
      <section className="nb-wrap pt-[clamp(2.4rem,5vw,4.2rem)] pb-[clamp(1.8rem,4vw,2.8rem)]">
        <p className="nb-marker">account made, inbox not yet proven</p>
        <h1 className="max-w-[17ch]">
          The link is in your inbox. Go and open it.
        </h1>
        <p className="nb-lede mt-[clamp(0.9rem,2vw,1.3rem)]">
          One click confirms the address is yours and signs you in on the spot.
          There is no code to copy and no second password to type.
        </p>
      </section>

      {/* ── The address, stamped on the one inverted surface ─────────── */}
      <section className="nb-slab py-[clamp(1.8rem,4vw,2.8rem)]">
        <div className="nb-wrap">
          <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-5">
            <div className="min-w-0">
              <p className="nb-slug text-card/85">sent to</p>
              {/* The address is the page. If it is wrong, nothing else here can
                  help, so it is set larger than the heading above it. */}
              <p className="mt-2 font-mono text-[clamp(1.25rem,0.7rem+2.1vw,2.3rem)] font-bold leading-tight [overflow-wrap:anywhere]">
                {email ?? "the address you signed up with"}
              </p>
            </div>
            <Postmark className="h-[3.6rem] w-[5.4rem] shrink-0 text-card opacity-75" />
          </div>

          <div className="nb-hair mt-[clamp(1.2rem,2.6vw,1.8rem)] flex flex-wrap gap-x-9 gap-y-1.5 pt-3.5">
            <p className="nb-slug text-card/85">one click, no code to copy</p>
            <p className="nb-slug text-card/85">
              works on any device, phone included
            </p>
          </div>
        </div>
      </section>

      {/* ── What to do when it does not arrive ───────────────────────── */}
      <section className="nb-wrap py-[clamp(2.4rem,5vw,4rem)]">
        <div className="grid gap-[clamp(1.8rem,4vw,3.4rem)] lg:grid-cols-[minmax(0,1fr)_minmax(0,19rem)]">
          <div>
            <h2 className="max-w-[18ch]">Nothing there yet?</h2>
            <p className="nb-sub mt-3">
              Work down these in order. Most of the time it is the third one.
            </p>

            <dl className="nb-list mt-[clamp(1.2rem,2.6vw,1.8rem)]">
              {CHECKS.map((check) => (
                <div
                  key={check.slug}
                  className="grid gap-1 border-b border-dashed border-rule py-4 sm:grid-cols-[minmax(0,7rem)_minmax(0,1fr)] sm:gap-6"
                >
                  <dt className="nb-slug">{check.slug}</dt>
                  <dd className="max-w-[52ch] text-[0.95rem] leading-snug text-graphite">
                    {check.text}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          {/* The margin. Resending is the fallback, not the instruction, so it
              is drawn rather than filled: the thing to do is open the inbox. */}
          <aside className="lg:pt-2">
            <p className="nb-marker">if all three fail</p>

            <div className="flex flex-col items-start gap-3">
              {email && <ResendButton email={email} />}
              <Link href="/login" className="nb-btn-ghost">
                Already confirmed, sign me in
              </Link>
            </div>

            <p className="nb-hair mt-6 pt-4 text-[0.95rem] leading-snug text-graphite">
              Typed the address wrong?{" "}
              <Link href="/signup" className="nb-link">
                Fill the roster line in again
              </Link>{" "}
              with the right one. Nothing is lost, the half-made account just
              never gets used.
            </p>

            <p className="mt-4 text-[0.95rem] leading-snug text-graphite">
              Confirming is only about the account. The guides and articles were
              never behind a login, so{" "}
              <Link href="/" className="nb-link">
                the rest of the site
              </Link>{" "}
              is open while you wait.
            </p>

            <p className="nb-pen mt-7 max-w-[24ch] rotate-[1.1deg]">
              school mail filters hard. a personal address gets through faster.
            </p>
          </aside>
        </div>
      </section>
    </>
  );
}
