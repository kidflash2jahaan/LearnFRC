import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { requireClassReviewer } from "@/lib/app/class-reviewers";
import { COORDINATOR } from "@/lib/classes/coordinator";
import {
  PLAYBOOK_ALWAYS,
  PLAYBOOK_HOLDS_NOTE,
  PLAYBOOK_INTRO,
  PLAYBOOK_SECTIONS,
  PLAYBOOK_TITLE,
  playbookPieces,
} from "@/lib/classes/playbook";
import { ClassReviewLocked } from "../holds/_locked";

export const metadata: Metadata = {
  // The root template appends " · LearnFRC".
  title: "Safety playbook",
  robots: { index: false, follow: false },
};

/**
 * /admin/classes/playbook: the one-page escalation playbook (classes-design.md
 * section 8.4), linked from every urgent class email. The text lives in
 * src/lib/classes/playbook.ts. Behind the same check as every class page
 * (super admins and the safety lead), so nothing about classes shows on the
 * site before they're launched.
 */

function Sentence({ text }: { text: string }) {
  return (
    <>
      {playbookPieces(text).map((p, i) =>
        p.href ? (
          p.external ? (
            <a key={i} href={p.href} className="nb-link" target="_blank" rel="noopener noreferrer">
              {p.text}
            </a>
          ) : (
            <Link key={i} href={p.href} className="nb-link">
              {p.text}
            </Link>
          )
        ) : (
          <span key={i}>{p.text}</span>
        )
      )}
    </>
  );
}

export default async function PlaybookPage() {
  const { user } = await getSession();
  if (!user) redirect("/login?next=/admin/classes/playbook");
  const gate = await requireClassReviewer(user);
  if (!gate.ok) return <ClassReviewLocked what="The safety playbook is for the people who review classes." />;

  return (
    <div className="nb-route pb-24">
      <section className="nb-wrap pt-10 lg:pt-16">
        <p className="nb-slug">
          <Link href="/admin/classes" className="nb-link">
            classes
          </Link>{" "}
          / playbook
        </p>
        <p className="nb-marker mt-3">sheet / safety playbook</p>
        <h1 className="max-w-[22ch] text-[clamp(2.2rem,1rem+3.4vw,3.4rem)]">{PLAYBOOK_TITLE}</h1>
        <p className="nb-lede mt-5 max-w-[62ch]">{PLAYBOOK_INTRO}</p>
      </section>

      <section className="nb-wrap mt-10">
        <ol className="grid max-w-[60rem] gap-8">
          {PLAYBOOK_SECTIONS.map((s) => (
            <li key={s.id} id={s.id} className={s.urgent ? "nb-box p-[clamp(1.1rem,3vw,1.8rem)]" : "nb-hair pt-6"}>
              <h2 className="text-[clamp(1.3rem,1.05rem+1vw,1.9rem)] leading-tight">{s.title}</h2>
              {s.examples ? <p className="nb-slug mt-2 max-w-[66ch]">{s.examples}</p> : null}
              {s.paragraphs?.map((p, i) => (
                <p key={i} className="mt-3 max-w-[66ch] text-[1rem] leading-relaxed">
                  <Sentence text={p} />
                </p>
              ))}
              {s.steps ? (
                <ol className="mt-3 grid max-w-[66ch] list-decimal gap-2 pl-6 text-[1rem] leading-relaxed">
                  {s.steps.map((step, i) => (
                    <li key={i}>
                      <Sentence text={step} />
                    </li>
                  ))}
                </ol>
              ) : null}
            </li>
          ))}
        </ol>
      </section>

      <section className="nb-wrap mt-12 border-t-2 border-ink pt-[clamp(2rem,4vw,3rem)]">
        <h2 className="text-[clamp(1.4rem,1.1rem+1.2vw,2rem)]">Every time</h2>
        <ul className="mt-4 grid max-w-[62ch] gap-2 text-[1rem] leading-relaxed">
          {PLAYBOOK_ALWAYS.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ul>
        <p className="nb-sub mt-6 max-w-[62ch]">
          <Sentence text={PLAYBOOK_HOLDS_NOTE} /> The holds are on{" "}
          <Link href="/admin/classes/holds" className="nb-link">
            /admin/classes/holds
          </Link>
          .
        </p>
        <p className="nb-slug mt-6">
          {COORDINATOR.name}, {COORDINATOR.title}
        </p>
      </section>
    </div>
  );
}
