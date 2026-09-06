import type { Metadata } from "next";
import Link from "next/link";
import { ReportForm } from "@/components/report-form";

export const metadata: Metadata = {
  // The root template appends " · LearnFRC", so don't repeat it here.
  title: "Contact",
  description:
    "Reach LearnFRC without an account: report an error, ask about the terms, or request access to or deletion of your data. No sign-up, no email address required.",
  alternates: { canonical: "/contact" },
};

/** What the one form is actually for. Slug on the left, the case on the right. */
const USES: { slug: string; text: string }[] = [
  {
    slug: "a factual error",
    text: "Something wrong in a lesson, article, or glossary entry: a stale rule reference, a wrong part number, a price that changed.",
  },
  {
    slug: "a privacy request",
    text: "Access to, correction of, or deletion of your account data, including full account deletion.",
  },
  {
    slug: "anything else",
    text: "A question about the Terms of Service, a takedown or attribution issue, or anything else that needs a human.",
  },
];

/**
 * The site's one reachable contact surface.
 *
 * There is no `mailto:` anywhere on LearnFRC any more: the domain publishes no
 * MX record, so every address that used to be printed on /privacy, /terms and
 * /about bounced silently, including the legally-operative "email us to
 * request deletion of your data" line. The maintainer is a minor, so the fix
 * could not be "publish a personal address". This form is the replacement, and
 * every one of those pages now links here.
 *
 * LAYOUT: one narrow column, and the form is the page rather than a card
 * halfway down it. The page used to open with a chip, a gradient headline and
 * three icon tiles before the reader reached anything they could type in, which
 * is backwards for a surface whose entire job is "say the thing and send it".
 * The form is ruled straight onto the paper instead of boxed, because
 * ReportForm swaps itself for a taped confirmation card on success: a card
 * appearing inside a card would read as a rendering fault, and a receipt
 * dropped onto a ruled page reads as what happened.
 *
 * Server Component. The form itself is the only client leaf.
 */
export default function ContactPage() {
  return (
    <div className="nb-wrap max-w-[52rem] py-[clamp(2.2rem,5vw,3.8rem)]">
      <header>
        <p className="nb-marker">contact / one form, one inbox</p>
        <h1 className="text-[clamp(2.2rem,1.2rem+3.4vw,3.4rem)]">
          Tell me what&rsquo;s <span className="nb-mark">wrong</span>.
        </h1>
        <p className="nb-lede mt-5">
          One form, straight to the person who runs the site. You don&rsquo;t
          need an account, and you don&rsquo;t need to give an email address
          unless you want a reply.
        </p>
      </header>

      {/* ---- the form, ruled onto the page ------------------------------ */}
      <section
        aria-labelledby="send"
        className="mt-[clamp(2rem,4vw,3rem)] border-t-2 border-ink pt-[clamp(1.4rem,3vw,2.2rem)]"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
          <h2 id="send" className="text-[clamp(1.4rem,1.1rem+1.1vw,1.9rem)]">
            Send a message
          </h2>
          <p className="nb-slug">nothing sent here is published</p>
        </div>

        <div className="mt-6">
          <ReportForm
            kind="contact"
            messageLabel="Your message"
            messagePlaceholder="What's the issue? If it's about a specific page, a link or the lesson title helps."
            pageLabel="Page it's about"
            submitLabel="Send message"
          />
        </div>
      </section>

      {/* ---- what it is for ---------------------------------------------
          A ruled ledger, not three tiles. Each row is a case and its example,
          which is a two-part shape, and a dashed rule between them carries
          that better than a border drawn all the way around each one. */}
      <section
        aria-labelledby="uses"
        className="mt-[clamp(2.4rem,5vw,3.6rem)] border-t-2 border-ink pt-[clamp(1.4rem,3vw,2.2rem)]"
      >
        <h2 id="uses" className="text-[clamp(1.4rem,1.1rem+1.1vw,1.9rem)]">
          What this is for
        </h2>
        <dl className="mt-5">
          {USES.map((u) => (
            <div
              key={u.slug}
              className="grid gap-x-[clamp(1rem,3vw,2.4rem)] gap-y-1 border-t border-dashed border-rule py-4 sm:grid-cols-[minmax(0,11rem)_minmax(0,1fr)]"
            >
              <dt className="nb-slug font-bold text-ink">{u.slug}</dt>
              <dd className="text-[0.99rem] leading-relaxed text-graphite">{u.text}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* ---- the aside ---------------------------------------------------
          The one card on the page, so it reads as a note pinned to the sheet
          rather than as the page's pattern. */}
      <div className="nb-box nb-tilt-3 mt-[clamp(2.4rem,5vw,3.6rem)] p-[clamp(1.1rem,2.6vw,1.8rem)]">
        <span className="nb-tape -top-3 left-[12%] rotate-[-3.2deg]" aria-hidden="true" />
        <p className="nb-slug">why there is no email address on this site</p>
        <p className="mt-3 max-w-[62ch] text-[0.99rem] leading-relaxed">
          LearnFRC is run by one high-school student. Publishing a personal
          mailbox on every page of a site this size is a privacy problem, and
          the domain doesn&rsquo;t run a mail server, so an address printed here
          would simply bounce. This form is the honest version of &ldquo;email
          us&rdquo;: it reaches the same person, and it works.
        </p>
      </div>

      {/* ---- the other route --------------------------------------------- */}
      <section
        aria-labelledby="edit"
        className="mt-[clamp(2.4rem,5vw,3.6rem)] border-t-2 border-ink pt-[clamp(1.4rem,3vw,2.2rem)]"
      >
        <h2 id="edit" className="text-[clamp(1.4rem,1.1rem+1.1vw,1.9rem)]">
          Want to fix the text yourself?
        </h2>
        <p className="mt-4 max-w-[64ch] text-[0.99rem] leading-relaxed text-graphite">
          Every lesson and article has a{" "}
          <strong className="font-bold text-ink">Suggest an edit</strong>{" "}
          control that lets you rewrite the markdown directly. That one needs a
          free account, because the change is credited to you and shows up in a
          public queue on the{" "}
          <Link href="/contributions" className="nb-link">
            contributions page
          </Link>
          . The form above needs nothing at all.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/corrections" className="nb-btn">
            See the corrections log
          </Link>
          <Link href="/guides" className="nb-btn-ghost">
            Browse the guides
          </Link>
        </div>
      </section>

      <p className="nb-hint mt-[clamp(2.4rem,5vw,3.4rem)] max-w-[68ch]">
        See also the{" "}
        <Link href="/privacy" className="nb-link">
          Privacy Policy
        </Link>{" "}
        and{" "}
        <Link href="/terms" className="nb-link">
          Terms of Service
        </Link>
        . LearnFRC is an independent educational project and is not affiliated
        with or endorsed by FIRST®. FIRST® and FRC® are trademarks of FIRST.
      </p>
    </div>
  );
}
