import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CLASS_SENTENCES, classEligibilityDetail } from "@/lib/app/classes";
import { latestParentRequest } from "@/lib/app/class-consent";
import { PUBLIC_CONTACT_EMAIL } from "@/lib/email";
import { PARENT_LIMITS } from "@/lib/classes/config";
import { birthYearOptions, roughWait, safeClassesNext } from "@/lib/classes/consent-rules";
import { usernameStepHref } from "@/lib/usernames";
import { AgeForm } from "./_age-form";
import { ParentForm } from "./_parent-form";

export const metadata: Metadata = {
  title: "Get ready for live classes",
  description: "A quick step before your first live class on LearnFRC.",
  robots: { index: false, follow: false },
};

/**
 * The steps before a first live class (classes-design.md sections 4, 5 and
 * 5.1): the one question, then the parent or guardian email, then ready. The
 * class page, /apply/teach and the room send people here with ?next= when
 * classEligibility says a step is missing, and it sends them back.
 *
 * THE AGE STEP SAYS NOTHING ABOUT AGES. Per the FTC's COPPA FAQ the question
 * is neutral: two empty selects, no default, no cutoff and no hint of what
 * any answer does. Everything this page prints while the state is
 * `needs_age` is checked for that (scripts/classes/checks/consent.check.ts).
 * The other states can be plain about it, because the answer is in.
 *
 * Server Component. The two forms are the client leaves.
 */

type Search = { next?: string };

function Card({
  slug,
  title,
  children,
  tilt = "nb-tilt-1",
}: {
  slug: string;
  title: string;
  children: ReactNode;
  tilt?: string;
}) {
  return (
    <div className={`nb-box ${tilt} mt-6 p-[clamp(1.1rem,2.6vw,1.8rem)]`}>
      <span className="nb-tape -top-3 left-[18%] rotate-[-2.8deg]" aria-hidden="true" />
      <p className="nb-slug">{slug}</p>
      <h2 className="mt-2 text-[clamp(1.3rem,1.1rem+0.8vw,1.7rem)]">{title}</h2>
      <div className="mt-3 flex max-w-[58ch] flex-col gap-3 text-[0.99rem] leading-relaxed">{children}</div>
    </div>
  );
}

export default async function ClassesReadyPage({ searchParams }: { searchParams: Promise<Search> }) {
  const { next: rawNext } = await searchParams;
  const next = safeClassesNext(rawNext);
  const here = `/classes/ready${next ? `?next=${encodeURIComponent(next)}` : ""}`;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const detail = await classEligibilityDetail(user);
  if (detail.state === "hidden") notFound();

  const waiting = detail.state === "waiting_parent" && user ? await latestParentRequest(user) : null;
  const heading =
    detail.state === "needs_age"
      ? "One quick question"
      : detail.state === "needs_parent" || detail.state === "waiting_parent"
        ? "A parent or guardian's OK"
        : detail.state === "ready"
          ? "You're all set"
          : "Live classes";

  return (
    <div className="nb-wrap max-w-[44rem] py-[clamp(2.2rem,5vw,3.8rem)]">
      <header>
        <p className="nb-marker">live classes / before you join</p>
        <h1 className="text-[clamp(2rem,1.2rem+3vw,3rem)]">{heading}</h1>
      </header>

      <section data-consent-step={detail.state} className="mt-[clamp(1.4rem,3vw,2.2rem)]">
        {detail.state === "signed_out" && (
          <Card slug="sign in first" title="Classes need a LearnFRC account">
            <p>Sign in, and this page picks up where you left off.</p>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-3">
              <Link href={`/login?next=${encodeURIComponent(here)}`} className="nb-btn">
                Sign in
              </Link>
              <span className="nb-hint">
                No account yet?{" "}
                <Link href={`/signup?next=${encodeURIComponent(here)}`} className="nb-link">
                  Make one
                </Link>
                , it&rsquo;s free.
              </span>
            </div>
          </Card>
        )}

        {detail.state === "needs_handle" && (
          <Card slug="one thing first" title="Choose your username">
            <p>{CLASS_SENTENCES.needsHandle}</p>
            {/* The step comes back here, and this page picks up at the next step. */}
            <Link href={usernameStepHref(here)} className="nb-btn mt-2 self-start">
              Choose your username
            </Link>
          </Card>
        )}

        {detail.state === "device_blocked" && (
          <Card slug="live classes" title="Not on this device">
            <p>{CLASS_SENTENCES.deviceBlocked}</p>
          </Card>
        )}

        {detail.state === "needs_age" && (
          <div className="border-t-2 border-ink pt-[clamp(1.2rem,3vw,1.8rem)]">
            <AgeForm years={birthYearOptions()} />
          </div>
        )}

        {detail.state === "adult" && (
          <Card slug="live classes" title="Classes aren't open to you">
            <p>{CLASS_SENTENCES.adult}</p>
            <Link href="/guides" className="nb-btn mt-2 self-start">
              Back to the lessons
            </Link>
          </Card>
        )}

        {detail.state === "needs_parent" && (
          <div className="border-t-2 border-ink pt-[clamp(1.2rem,3vw,1.8rem)]">
            <p className="max-w-[58ch] text-[0.99rem] leading-relaxed text-graphite">
              Every class is recorded and reviewed, so a parent or guardian says OK once before your first
              one. They get one email that explains it, with a button to decide.
              {detail.username ? (
                <>
                  {" "}
                  The email to them will name you as{" "}
                  <span className="font-semibold text-ink">@{detail.username}</span>.
                </>
              ) : null}
            </p>
            <ParentForm />
          </div>
        )}

        {detail.state === "waiting_parent" && (
          <>
            <Card slug="sent / waiting" title="Waiting for your parent or guardian">
              <p>
                We emailed {waiting?.parentEmail ?? "them"}. The button in it works for{" "}
                {PARENT_LIMITS.tokenDays} days.
              </p>
              <p>
                {waiting && waiting.resendWaitMs > 0
                  ? `You can send it to the same address again in ${roughWait(waiting.resendWaitMs)}, or use a different address now.`
                  : "If it didn't arrive, ask them to check their spam folder, then send it again."}
              </p>
              <p className="text-graphite">
                You can sign up for a class already. Joining one opens once they say OK.
              </p>
            </Card>
            <div className="mt-[clamp(1.6rem,3vw,2.2rem)] border-t-2 border-ink pt-[clamp(1.2rem,3vw,1.8rem)]">
              <ParentForm again initialEmail={waiting?.parentEmail ?? ""} />
            </div>
          </>
        )}

        {detail.state === "parent_declined" && (
          <Card slug="live classes" title="Classes are closed for this account">
            <p>{CLASS_SENTENCES.parentDeclined}</p>
            <Link href="/guides" className="nb-btn mt-2 self-start">
              Back to the lessons
            </Link>
          </Card>
        )}

        {detail.state === "ready" && (
          <Card slug="ready" title="Your parent or guardian said OK">
            <p>You can sign up for live classes and join them. Before every class you&rsquo;ll see the recording notice.</p>
            <Link href={next ?? "/classes"} className="nb-btn mt-2 self-start">
              {next ? "Back to where you were" : "Find a class"}
            </Link>
          </Card>
        )}
      </section>

      {detail.state !== "needs_age" && (
        <p className="nb-hint mt-[clamp(1.8rem,4vw,2.6rem)]">
          Questions about live classes? Write to{" "}
          <a href={`mailto:${PUBLIC_CONTACT_EMAIL}`} className="nb-link">
            {PUBLIC_CONTACT_EMAIL}
          </a>
          .
        </p>
      )}
    </div>
  );
}
