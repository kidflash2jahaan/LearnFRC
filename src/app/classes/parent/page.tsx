import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { loadParentRequest, type ParentRequestView } from "@/lib/app/class-consent";
import { PUBLIC_CONTACT_EMAIL } from "@/lib/email";
import { PARENT_LIMITS, classesVisible } from "@/lib/classes/config";
import { CLASS_NOTICE, CLASS_NOTICE_CHECKBOX } from "@/lib/classes/notice";
import { PARENT_COOKIE } from "@/lib/classes/consent-rules";
import { PARENT_NOTICE } from "@/lib/classes/emails-parent";
import { DecideForm } from "./_decide-form";

export const metadata: Metadata = {
  title: "A parent or guardian's OK",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

// Reads the lf_parent cookie, and is a 404 while classes are hidden: never
// prerendered, so the hidden 404 can't outlive the switch being turned on.
export const dynamic = "force-dynamic";

/**
 * Where a parent or guardian decides (classes-design.md section 5.1). No
 * account needed. The emailed link goes through
 * /classes/parent/open/<token>, which leaves the token in the lf_parent
 * cookie and sends the browser here, so the token is never in this page's
 * URL. This page reads the cookie: the full notice, a name field, and
 * I agree / I don't agree (a POST, so nothing is decided by opening a link).
 *
 * The URL only ever carries what happened, never who: ?done=agreed or
 * ?done=declined after an answer, ?link=closed for a used or expired link,
 * ?link=busy when one network tried too often.
 */

type Search = { link?: string; done?: string };

function Receipt({ slug, title, children }: { slug: string; title: string; children: ReactNode }) {
  return (
    <div className="nb-box nb-tilt-1 mt-6 p-[clamp(1.3rem,3vw,2rem)]">
      <span className="nb-tape -top-3 left-[22%] rotate-[-3.4deg]" aria-hidden="true" />
      <p className="nb-slug">{slug}</p>
      <h1 className="mt-3 text-[clamp(1.6rem,1.2rem+1.6vw,2.2rem)]">{title}</h1>
      <div className="mt-4 flex flex-col gap-3 text-[0.99rem] leading-relaxed text-graphite">{children}</div>
    </div>
  );
}

const contact = (
  <a href={`mailto:${PUBLIC_CONTACT_EMAIL}`} className="nb-link">
    {PUBLIC_CONTACT_EMAIL}
  </a>
);

export default async function ParentOkPage({ searchParams }: { searchParams: Promise<Search> }) {
  if (!(await classesVisible())) notFound();
  const { link, done } = await searchParams;
  const token = (await cookies()).get(PARENT_COOKIE)?.value;
  const view: ParentRequestView = token ? await loadParentRequest(token) : { open: false };

  if (!view.open) {
    return (
      <div className="nb-wrap flex min-h-[60dvh] max-w-[38rem] flex-col justify-center py-[clamp(2.5rem,6vw,4rem)]">
        {done === "agreed" ? (
          <Receipt slug="learnfrc / live classes / answered" title="Thank you. You said OK.">
            <p>
              Live classes are open for your teen now. We&rsquo;ve emailed them to say so. Every class is
              recorded and reviewed, and your teen accepts the recording notice before each one.
            </p>
            <p>If you change your mind, write to {contact} and we&rsquo;ll close classes for them.</p>
          </Receipt>
        ) : done === "declined" ? (
          <Receipt slug="learnfrc / live classes / answered" title="Got it. You didn't say OK.">
            <p>
              Live classes stay closed for your teen, and we&rsquo;ve emailed them to say so. Every lesson on
              LearnFRC is still free for them to read.
            </p>
            <p>If you change your mind, write to {contact}.</p>
          </Receipt>
        ) : link === "busy" ? (
          <Receipt slug="learnfrc / live classes / too many tries" title="Too many tries from this network.">
            <p>Wait an hour, then open the button in the email again. Nothing was changed.</p>
          </Receipt>
        ) : link === "closed" || token ? (
          <Receipt slug="learnfrc / live classes / link closed" title="This link has been used, or it has expired.">
            <p>
              Each email&rsquo;s button works once, for {PARENT_LIMITS.tokenDays} days. If your teen still wants
              to join live classes, they can send a new request from LearnFRC.
            </p>
            <p>Questions? Write to {contact}.</p>
          </Receipt>
        ) : (
          <Receipt slug="learnfrc / live classes" title="Open the button in the email.">
            <p>
              This page is where a parent or guardian answers a request about LearnFRC&rsquo;s live classes. It
              opens from the button in the email we sent you.
            </p>
            <p>Questions? Write to {contact}.</p>
          </Receipt>
        )}
        <div className="mt-6">
          <Link href="/" className="nb-btn-ghost">
            Go to LearnFRC
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="nb-wrap max-w-[46rem] py-[clamp(2.2rem,5vw,3.8rem)]">
      <header>
        <p className="nb-marker">live classes / a parent or guardian&rsquo;s OK</p>
        <h1 className="text-[clamp(1.9rem,1.1rem+3vw,2.9rem)]">@{view.studentHandle} asked to join live classes.</h1>
        <p className="nb-lede mt-5">
          Classes open for them only if you say OK. Here&rsquo;s what that means, then your answer.
        </p>
      </header>

      <section
        aria-labelledby="facts"
        className="mt-[clamp(1.8rem,4vw,2.6rem)] border-t-2 border-ink pt-[clamp(1.2rem,3vw,1.8rem)]"
      >
        <h2 id="facts" className="text-[clamp(1.3rem,1.1rem+0.9vw,1.7rem)]">
          What you&rsquo;re saying OK to
        </h2>
        <div className="nb-prose mt-4 max-w-[64ch]">
          <ul>
            {PARENT_NOTICE.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </div>
      </section>

      <section
        aria-labelledby="notice"
        className="mt-[clamp(1.8rem,4vw,2.6rem)] border-t-2 border-ink pt-[clamp(1.2rem,3vw,1.8rem)]"
      >
        <h2 id="notice" className="text-[clamp(1.3rem,1.1rem+0.9vw,1.7rem)]">
          What your teen accepts before every class
        </h2>
        <div className="nb-note mt-4 max-w-[64ch]">
          <p className="nb-slug">the recording notice</p>
          <div className="mt-2.5 flex flex-col gap-3 text-[0.97rem] leading-relaxed">
            {CLASS_NOTICE.map((p) => (
              <p key={p}>{p}</p>
            ))}
            <p className="font-semibold">&ldquo;{CLASS_NOTICE_CHECKBOX}&rdquo;</p>
          </div>
        </div>
      </section>

      <section
        aria-labelledby="answer"
        className="mt-[clamp(1.8rem,4vw,2.6rem)] border-t-2 border-ink pt-[clamp(1.2rem,3vw,1.8rem)]"
      >
        <h2 id="answer" className="text-[clamp(1.3rem,1.1rem+0.9vw,1.7rem)]">
          Your answer
        </h2>
        <p className="mt-3 max-w-[60ch] text-[0.99rem] leading-relaxed text-graphite">
          This link works once. Whichever you choose, we&rsquo;ll email your teen to let them know, and you can
          change your mind later by writing to {contact}.
        </p>
        <DecideForm />
      </section>
    </div>
  );
}
