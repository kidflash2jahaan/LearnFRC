import type { Metadata } from "next";
import Link from "next/link";
import { getVerificationProgress } from "@/lib/queries";
import { createPublicClient } from "@/lib/supabase/public";

/**
 * The public record of the fact-check.
 *
 * WHY THIS PAGE EXISTS. A badge on a lesson is a claim about that lesson. This
 * page is what makes the claim auditable: how many of the 394 have actually
 * been read, which ones, by whom, and on what date. Without it, a reader who
 * finds one badged lesson has no way to tell whether five were checked or five
 * hundred, and the badge is worth nothing.
 *
 * It is also deliberately unflattering at the start. "3 of 394" is a worse
 * number than saying nothing, and publishing it anyway is the point: a progress
 * bar that begins near zero and moves is evidence, where a finished-looking
 * site is just an assertion.
 */

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Fact-check progress",
  description:
    "Which LearnFRC lessons have been read line by line against primary sources, by whom, and when. Updated as the pass continues.",
  alternates: { canonical: "/fact-check" },
};

export default async function FactCheckPage() {
  const { checked, total } = await getVerificationProgress().catch(() => ({
    checked: 0,
    total: 0,
  }));

  const supabase = createPublicClient();
  const { data } = await supabase
    .from("lessons")
    .select("slug, title, verified_at, modules(slug, departments(slug, name))")
    .not("verified_at", "is", null)
    .order("verified_at", { ascending: false })
    .limit(200);

  type Row = {
    slug: string;
    title: string;
    verified_at: string;
    modules: { slug: string; departments: { slug: string; name: string } } | null;
  };
  const rows = (data ?? []) as unknown as Row[];
  const pct = total > 0 ? Math.round((checked / total) * 100) : 0;

  return (
    <main className="nb-wrap py-[clamp(2rem,5vw,3.5rem)]">
      <p className="nb-marker">the record</p>
      <h1 className="max-w-[20ch]">What has actually been checked.</h1>

      <p className="nb-lede mt-[clamp(0.9rem,2vw,1.3rem)] max-w-[62ch]">
        Every lesson on this site is being read line by line against primary
        sources: the WPILib docs, the game manual, vendor documentation. A
        lesson only carries a check mark once a person has done that and put
        their name on it. This page is the running total, including the part
        that is not done.
      </p>

      <div className="nb-box mt-[clamp(1.6rem,4vw,2.4rem)] p-[clamp(1.1rem,3vw,1.8rem)]">
        <p className="flex flex-wrap items-baseline gap-x-3">
          <b className="font-mono text-[clamp(2rem,1.4rem+2vw,3rem)] leading-none tabular-nums text-[var(--blue)]">
            {checked}
          </b>
          <span className="nb-slug">
            of {total.toLocaleString()} lessons checked
          </span>
        </p>
        {/* A bar, so the shape of the work is visible at a glance. Given an
            explicit width rather than a percentage-only fill so it still reads
            correctly at 0. */}
        <div
          className="mt-3 h-3 w-full border-2 border-[var(--ink)]"
          role="img"
          aria-label={`${checked} of ${total} lessons checked, ${pct} percent`}
        >
          <div
            className="h-full bg-[var(--blue)]"
            style={{ width: `${Math.max(pct, checked > 0 ? 1 : 0)}%` }}
          />
        </div>
        <p className="mt-3 text-[0.9rem] leading-relaxed text-[var(--graphite)]">
          A check means the lesson was read against primary sources on the date
          shown. It is not a guarantee, and the rules change every season.
          Anything unchecked is still readable, it just has not been through
          this pass yet.
        </p>
      </div>

      {rows.length > 0 ? (
        <section className="mt-[clamp(2rem,5vw,3rem)]">
          <h2 className="text-[clamp(1.2rem,1rem+1vw,1.6rem)]">
            Checked so far
          </h2>
          <ul className="mt-4 grid gap-2">
            {rows.map((r) => {
              const dept = r.modules?.departments;
              const href = dept
                ? `/guides/${dept.slug}/${r.modules?.slug}/${r.slug}`
                : null;
              const when = new Date(r.verified_at).toLocaleDateString("en-GB", {
                day: "numeric",
                month: "short",
                timeZone: "UTC",
              });
              return (
                <li key={r.slug} className="nb-hair pb-2">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    {href ? (
                      <Link href={href} className="nb-link font-semibold">
                        {r.title}
                      </Link>
                    ) : (
                      <span className="font-semibold">{r.title}</span>
                    )}
                    <span className="nb-slug shrink-0 text-[var(--graphite)]">
                      {when}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ) : (
        <section className="mt-[clamp(2rem,5vw,3rem)]">
          <div className="nb-box p-[clamp(1.1rem,3vw,1.6rem)]">
            <p className="nb-slug">nothing checked yet</p>
            <p className="mt-2 max-w-[58ch] text-[0.95rem] leading-relaxed text-[var(--graphite)]">
              The pass has not started. When it does, every lesson that has been
              read appears here with the date. Until then this page is the
              honest answer to how far it has got.
            </p>
          </div>
        </section>
      )}

      <section className="mt-[clamp(2rem,5vw,3rem)]">
        <h2 className="text-[clamp(1.2rem,1rem+1vw,1.6rem)]">
          Found something wrong?
        </h2>
        <p className="mt-3 max-w-[60ch] leading-relaxed text-[var(--graphite)]">
          A checked lesson can still be wrong, and saying so is the fastest way
          to fix it. Every lesson has a suggest-an-edit control at the foot, and
          corrections are logged in the open on the{" "}
          <Link href="/corrections" className="nb-link">
            corrections page
          </Link>
          .
        </p>
      </section>
    </main>
  );
}
