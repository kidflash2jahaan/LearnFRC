import type { CSSProperties } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  MessageSquare,
  ScrollText,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { Reveal, Glow } from "@/components/motion/primitives";
import { ReportForm } from "@/components/report-form";

export const metadata: Metadata = {
  // The root template appends " · LearnFRC" — don't repeat it here.
  title: "Contact",
  description:
    "Reach LearnFRC without an account: report an error, ask about the terms, or request access to or deletion of your data. No sign-up, no email address required.",
  alternates: { canonical: "/contact" },
};

const HEADLINE_GRADIENT: CSSProperties = {
  background: "linear-gradient(120deg,#2560e6,#1aa9d6)",
  WebkitBackgroundClip: "text",
  backgroundClip: "text",
  color: "transparent",
};

const LINK =
  "rounded-sm font-medium text-primary underline decoration-primary/40 underline-offset-2 transition-colors hover:text-accent hover:decoration-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

const USES: { icon: typeof ShieldCheck; accent: string; text: string }[] = [
  {
    icon: ScrollText,
    accent: "#2560e6",
    text: "A factual error in a lesson, article, or glossary entry: a stale rule reference, a wrong part number, a price that changed.",
  },
  {
    icon: Trash2,
    accent: "#0a7a43",
    text: "A privacy request: access to, correction of, or deletion of your account data, including full account deletion.",
  },
  {
    icon: MessageSquare,
    accent: "#7c5cff",
    text: "A question about the Terms of Service, a takedown or attribution issue, or anything else that needs a human.",
  },
];

/**
 * The site's one reachable contact surface.
 *
 * There is no `mailto:` anywhere on LearnFRC any more: the domain publishes no
 * MX record, so every address that used to be printed on /privacy, /terms and
 * /about bounced silently — including the legally-operative "email us to
 * request deletion of your data" line. The maintainer is a minor, so the fix
 * could not be "publish a personal address". This form is the replacement, and
 * every one of those pages now links here.
 */
export default function ContactPage() {
  return (
    <div className="relative overflow-x-clip">
      <Glow
        blobs={[
          { size: "600px", pos: { left: "-160px", top: "-180px" }, color: "#8bbcff", opacity: 0.55 },
          { size: "520px", pos: { right: "-140px", top: "-80px" }, color: "#9bd0ff", opacity: 0.45, delay: 2 },
        ]}
      />

      <section className="mx-auto max-w-3xl px-4 pb-24 pt-28 sm:px-6 lg:px-8 lg:pt-32">
        <Reveal>
          <span className="ac-chip inline-flex items-center gap-2">
            <MessageSquare className="h-3.5 w-3.5 text-primary" aria-hidden />
            <span className="ac-eyebrow">No account needed</span>
          </span>
          <h1 className="mt-5 text-balance font-display text-4xl font-extrabold leading-[1.05] sm:text-5xl">
            Contact <span style={HEADLINE_GRADIENT}>LearnFRC</span>
          </h1>
          <p className="mt-4 text-pretty text-lg leading-relaxed text-foreground/70">
            One form, straight to the person who runs the site. You don&rsquo;t
            need an account, and you don&rsquo;t need to give an email address
            unless you want a reply.
          </p>
        </Reveal>

        <Reveal>
          <div className="ac-card mt-8 p-5 sm:p-7">
            <h2 className="font-display text-xl font-bold text-foreground">
              Send a message
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Messages land in the maintainer&rsquo;s inbox. Nothing you send
              here is published on the site.
            </p>
            <div className="mt-5">
              <ReportForm
                kind="contact"
                messageLabel="Your message"
                messagePlaceholder="What's the issue? If it's about a specific page, a link or the lesson title helps."
                pageLabel="Page it's about"
                submitLabel="Send message"
              />
            </div>
          </div>
        </Reveal>

        <Reveal>
          <h2 className="mt-12 font-display text-xl font-bold text-foreground">
            What this is for
          </h2>
          <ul className="mt-4 space-y-3">
            {USES.map((u) => (
              <li key={u.text} className="ac-card flex items-start gap-3.5 p-4 sm:p-5">
                <span
                  aria-hidden
                  className="ac-badge grid h-10 w-10 shrink-0 place-items-center"
                  style={{ "--a": u.accent } as CSSProperties}
                >
                  <u.icon className="h-5 w-5" aria-hidden />
                </span>
                <p className="text-sm leading-relaxed text-foreground/80">{u.text}</p>
              </li>
            ))}
          </ul>
        </Reveal>

        <Reveal>
          <div className="ac-card mt-8 p-5 sm:p-6">
            <h2 className="font-display text-base font-bold text-foreground">
              Why there&rsquo;s no email address on this site
            </h2>
            <p className="mt-2.5 text-sm leading-relaxed text-foreground/80">
              LearnFRC is run by one high-school student. Publishing a personal
              mailbox on every page of a site this size is a privacy problem, and
              the domain doesn&rsquo;t run a mail server, so an address printed
              here would simply bounce. This form is the honest version of
              &ldquo;email us&rdquo;: it reaches the same person, and it works.
            </p>
          </div>
        </Reveal>

        <Reveal>
          <div className="ac-card mt-8 p-5 sm:p-6">
            <h2 className="font-display text-base font-bold text-foreground">
              Want to fix the text yourself?
            </h2>
            <p className="mt-2.5 text-sm leading-relaxed text-foreground/80">
              Every lesson and article has a{" "}
              <span className="font-semibold text-foreground">Suggest an edit</span>{" "}
              control that lets you rewrite the markdown directly. That one needs
              a free account, because the change is credited to you and shows up
              in a public queue on the{" "}
              <Link href="/contributions" className={LINK}>
                contributions page
              </Link>
              . The form above needs nothing at all.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link href="/corrections" className="ac-btn text-sm">
                See the corrections log <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
              <Link href="/guides" className="ac-btn-ghost text-sm">
                Browse the guides
              </Link>
            </div>
          </div>
        </Reveal>

        <Reveal>
          <p className="mt-8 text-xs leading-relaxed text-muted-foreground">
            See also the{" "}
            <Link href="/privacy" className={LINK}>
              Privacy Policy
            </Link>{" "}
            and{" "}
            <Link href="/terms" className={LINK}>
              Terms of Service
            </Link>
            . LearnFRC is an independent educational project and is not
            affiliated with or endorsed by FIRST®. FIRST® and FRC® are
            trademarks of FIRST.
          </p>
        </Reveal>
      </section>
    </div>
  );
}
