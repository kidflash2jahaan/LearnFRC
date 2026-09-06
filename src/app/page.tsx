import type { Metadata } from "next";
import Link from "next/link";
import { getDepartments, getOverviewStats } from "@/lib/queries";
import { DEPT_CATALOG } from "@/lib/dept-catalog";
import { PATHS } from "@/lib/paths-data";
import { SocialProof } from "@/components/social-proof";
import { HeroPanel, type HeroDept } from "./_hero-panel";

// Title/description/OG are inherited from the root layout defaults (which are
// written for the home page); we only pin the self-referential canonical.
export const metadata: Metadata = {
  // Tighter than the sitewide fallback so the home SERP snippet isn't truncated.
  description:
    "Free, structured guides to every department of the FIRST Robotics Competition: mechanical, CAD, programming, electrical, strategy, business and more.",
  alternates: { canonical: "/" },
};

/**
 * Where each index card sits on the wall.
 *
 * The eleven departments are pinned to a 12-column grid in rows that sum to
 * exactly 12 (5+4+3, 3+4+5, 5+3+4, 7+5), so the wall never ends on a half-empty
 * row. Every card gets its own tilt and its own tape angle: the system's rule is
 * that no two pieces on one screen were straightened the same way, and a shared
 * angle is the thing that makes a "hand-taped" wall read as a CSS loop instead.
 *
 * Class names are written out in full rather than composed, because Tailwind
 * scans raw source text and would never see a string it has to concatenate.
 */
const WALL = [
  { span: "sm:col-span-6 lg:col-span-5", tilt: "nb-tilt-1", tape: "left-[16px] rotate-[-4deg]" },
  { span: "sm:col-span-6 lg:col-span-4", tilt: "nb-tilt-2", tape: "left-[24%] rotate-[3.2deg]" },
  { span: "sm:col-span-6 lg:col-span-3", tilt: "nb-tilt-3", tape: "left-[12px] rotate-[-2.4deg]" },
  { span: "sm:col-span-6 lg:col-span-3", tilt: "nb-tilt-4", tape: "right-[14px] rotate-[4.4deg]" },
  { span: "sm:col-span-6 lg:col-span-4", tilt: "nb-tilt-1", tape: "left-[28%] rotate-[-5deg]" },
  { span: "sm:col-span-6 lg:col-span-5", tilt: "nb-tilt-2", tape: "left-[18px] rotate-[2.6deg]" },
  { span: "sm:col-span-6 lg:col-span-5", tilt: "nb-tilt-3", tape: "right-[20%] rotate-[-3.4deg]" },
  { span: "sm:col-span-6 lg:col-span-3", tilt: "nb-tilt-4", tape: "left-[14px] rotate-[5.2deg]" },
  { span: "sm:col-span-6 lg:col-span-4", tilt: "nb-tilt-1", tape: "left-[32%] rotate-[-2deg]" },
  { span: "sm:col-span-6 lg:col-span-7", tilt: "nb-tilt-2", tape: "left-[24px] rotate-[3.8deg]", wide: true },
  { span: "sm:col-span-12 lg:col-span-5", tilt: "nb-tilt-3", tape: "right-[18%] rotate-[-4.8deg]" },
] as const;

/** The read, quiz, certificate loop. Printed on the one inverted band. */
const LOOP = [
  {
    n: "1",
    title: "Read the lesson",
    body: "One lesson is one topic, sized to finish in a single meeting. Nothing is gated, so you can open it on the shop floor without an account.",
  },
  {
    n: "2",
    title: "Pass the quiz",
    body: "Every lesson ends in a short quiz on the thing that actually breaks robots, not the vocabulary word you skimmed past. Retakes are unlimited.",
  },
  {
    n: "3",
    title: "Keep the certificate",
    body: "Clear every quiz in a department and it issues a certificate for that department. Mentors use them to see who is trained on what.",
  },
];

/**
 * The eight failure modes that actually stop an FRC robot on competition day,
 * each pointed at the article that diagnoses it. Curated on purpose: these are
 * the highest-intent pages we publish (someone searching "no robot code" needs
 * an answer in the next ten minutes), and they are the ones a homepage link
 * genuinely helps a human find. Slugs are verified against the articles table.
 *
 * `symptom` is the lookup key, so it is set as a mono slug: it is what the
 * person in the pit would type, and it has to be scannable down the column.
 */
const PIT_FIXES = [
  {
    href: "/blog/frc-no-robot-code-driver-station-troubleshooting",
    symptom: "driver station says no robot code",
    title: "Every cause of No Robot Code, in the order to check them",
  },
  {
    href: "/blog/frc-wpilib-deploy-troubleshooting",
    symptom: "the code will not deploy",
    title: "WPILib deploy failures: build errors, RIO comms, and Gradle",
  },
  {
    href: "/blog/frc-status-lights-and-error-codes",
    symptom: "a light is blinking and nobody knows why",
    title: "FRC status lights and blink codes: the complete decoder",
  },
  {
    href: "/blog/frc-radio-networking-guide",
    symptom: "nothing can connect to the robot",
    title: "Robot radio and networking: setup, IP addresses, and the 2026 change",
  },
  {
    href: "/blog/frc-can-bus",
    symptom: "can devices keep dropping off the bus",
    title: "FRC CAN bus explained, and how to fix common problems",
  },
  {
    href: "/blog/frc-battery-guide",
    symptom: "batteries die halfway through a match",
    title: "FRC battery guide: charging, care, testing, and safety",
  },
  {
    href: "/blog/frc-swerve-module-offsets-calibration",
    symptom: "swerve wheels point the wrong way",
    title: "Swerve module offsets: calibration and backwards wheels",
  },
  {
    href: "/blog/frc-inspection-checklist-guide",
    symptom: "inspection is in an hour",
    title: "How to pass FRC robot inspection: full walkthrough",
  },
];

/**
 * The five calculators, set as a reference table rather than as cards: what a
 * calculator is worth is entirely in what you feed it and what it hands back,
 * and a three-column table says both at a glance where a tile would only say
 * the name twice.
 */
const TOOLS = [
  {
    href: "/tools/frc-budget-calculator",
    name: "Team budget",
    input: "line items and quantities",
    output: "what a season actually costs, itemized for a sponsor",
  },
  {
    href: "/tools/frc-wire-gauge-calculator",
    name: "Wire gauge",
    input: "current, run length, gauge",
    output: "voltage drop, checked against the minimum legal AWG",
  },
  {
    href: "/tools/frc-tipping-calculator",
    name: "Tip-over",
    input: "track, wheelbase, center of gravity",
    output: "the angle where the robot goes over",
  },
  {
    href: "/tools/frc-current-budget",
    name: "Brownout",
    input: "every motor and its stall draw",
    output: "total draw against the 120 A main breaker and the roboRIO threshold",
  },
  {
    href: "/tools/frc-deflection-calculator",
    name: "Deflection",
    input: "span, load, section",
    output: "how far that arm or rail sags, plus the safety factor",
  },
];

export default async function HomePage() {
  const [departmentsRaw, stats] = await Promise.all([
    getDepartments().catch(() => []),
    getOverviewStats().catch(() => ({
      deptCount: 11,
      moduleCount: 101,
      lessonCount: 394,
      learners: 0,
    })),
  ]);

  const departments =
    departmentsRaw.length > 0
      ? departmentsRaw
      : DEPT_CATALOG.map((c, i) => ({
          ...c,
          id: c.slug,
          description: null,
          tagline: c.tagline,
          moduleCount: 0,
          lessonCount: 0,
          sort_order: i,
        }));

  // Top departments by lesson count feed the share meters on the hero card.
  // Departments carry no colour and no icon in this system, so nothing but the
  // name, the slug and the count crosses into the panel.
  const heroDepts: HeroDept[] = [...departments]
    .sort((a, b) => (b.lessonCount ?? 0) - (a.lessonCount ?? 0))
    .slice(0, 4)
    .map((d) => ({
      slug: d.slug,
      name: d.name,
      lessons: d.lessonCount ?? 0,
    }));

  return (
    <div className="nb-route">
      {/* ===================== 1. HERO ==========================
          Asymmetric split: the claim on the left, the catalogue taped up on
          the right. No eyebrow, no trust strip, no badge. Four things only. */}
      <section className="nb-wrap grid items-start gap-[clamp(1.6rem,4vw,3.6rem)] pb-[clamp(3rem,6vw,5rem)] pt-[clamp(2.4rem,5vw,4.2rem)] lg:grid-cols-[minmax(0,1.5fr)_minmax(0,0.82fr)]">
        <div>
          <h1 className="max-w-[21ch]">
            Every job on an FRC team, <span className="nb-mark">written down</span>.
          </h1>
          <p className="nb-lede mt-[clamp(1rem,2vw,1.5rem)]">
            {stats.deptCount} departments, from swerve geometry to sponsor
            letters. Free to read, and nothing sits behind a login.
          </p>
          <div className="mt-[clamp(1.4rem,2.6vw,2rem)] flex flex-wrap gap-3">
            <Link href="/signup" className="nb-btn">
              Start learning
            </Link>
            <Link href="/guides" className="nb-btn-ghost">
              Browse the departments
            </Link>
          </div>
        </div>

        <HeroPanel
          lessonCount={stats.lessonCount}
          deptCount={stats.deptCount}
          depts={heroDepts}
        />
      </section>

      {/* ================ 2. THE DEPARTMENT WALL =================
          The page's primary action, and the only place eleven of anything
          appears. Unequal spans on a 12-column grid, every card taped and
          tilted, so the wall reads as pinned paper rather than as a card kit. */}
      <section id="departments" className="nb-rule">
        <div className="nb-wrap py-[clamp(2.6rem,5vw,4.4rem)]">
          <p className="nb-marker">
            {stats.deptCount} departments / {stats.lessonCount} lessons
          </p>
          <h2>Pick the department you are actually on.</h2>
          <p className="nb-sub mt-4">
            Every lesson lives in exactly one department, so a new member can be
            handed a place to start on their first day and a mentor can see what
            is left.
          </p>

          <div className="mt-[clamp(1.6rem,3.4vw,2.6rem)] grid grid-cols-12 gap-[clamp(0.85rem,1.7vw,1.35rem)]">
            {departments.map((d, i) => {
              const cell = WALL[i % WALL.length];
              const lessons = d.lessonCount ?? 0;
              return (
                <Link
                  key={d.slug}
                  href={`/guides/${d.slug}`}
                  className={`nb-box nb-lift ${cell.tilt} ${cell.span} col-span-12 flex flex-col p-[clamp(1rem,1.9vw,1.45rem)] no-underline ${
                    "wide" in cell && cell.wide
                      ? "lg:flex-row lg:items-center lg:gap-[clamp(1.2rem,3vw,2.6rem)]"
                      : ""
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`nb-tape -top-3 h-[21px] w-[74px] ${cell.tape}`}
                  />
                  <div
                    className={
                      "wide" in cell && cell.wide
                        ? "mb-3 lg:mb-0 lg:min-w-0 lg:flex-1"
                        : "mb-3"
                    }
                  >
                    <p className="nb-slug">dept / {d.slug}</p>
                    <h3 className="mt-2">{d.name}</h3>
                    {d.tagline && (
                      <p className="mt-2 text-[0.92rem] leading-snug text-graphite">
                        {d.tagline}
                      </p>
                    )}
                  </div>
                  {/* mt-auto pins the foot to the bottom of a short card. The
                      mb-3 above is what keeps the dashed rule off the last line
                      of a card whose copy fills the box, where mt-auto resolves
                      to nothing. */}
                  <div
                    className={`nb-hair mt-auto flex items-baseline justify-between gap-3 pt-4 ${
                      "wide" in cell && cell.wide
                        ? "lg:mt-0 lg:flex-col lg:items-start lg:gap-2 lg:border-t-0 lg:border-l lg:border-dashed lg:border-l-[var(--rule)] lg:pl-[clamp(1.1rem,2.4vw,2rem)] lg:pt-0"
                        : ""
                    }`}
                  >
                    {lessons > 0 ? (
                      <span className="nb-count">
                        {lessons}
                        <small>lessons</small>
                      </span>
                    ) : (
                      <span />
                    )}
                    <span className="nb-slug text-ink">open</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* ================== 3. THE LOOP ==========================
          The one inverted surface on the page, spent on the thing that makes
          this a course and not a wiki: read, quiz, certificate. Card stock on
          ballpoint blue, with the step numbers set as index chits. */}
      <section id="certificates" className="nb-slab">
        <div className="nb-wrap grid gap-[clamp(1.6rem,4vw,3.2rem)] py-[clamp(2.6rem,5vw,4rem)] lg:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)]">
          <div>
            <h2 className="max-w-[16ch] text-card">
              Read it, pass the quiz, keep the certificate.
            </h2>
            <p className="mt-4 max-w-[34ch] text-[0.98rem] leading-relaxed text-[rgba(245,246,242,0.85)]">
              Certificates are issued per department, not per lesson, which is
              why the departments are the shape of the whole site.
            </p>
          </div>

          <ol className="flex flex-col">
            {LOOP.map((s, i) => (
              <li
                key={s.n}
                className={`flex gap-4 ${i > 0 ? "nb-hair mt-5 pt-5" : ""}`}
              >
                <span
                  aria-hidden="true"
                  className="nb-box-sm grid h-11 w-11 shrink-0 place-items-center font-mono text-lg font-bold text-ink"
                >
                  {s.n}
                </span>
                <div className="min-w-0">
                  <h3 className="text-card">{s.title}</h3>
                  <p className="mt-2 max-w-[52ch] text-[0.95rem] leading-relaxed text-[rgba(245,246,242,0.85)]">
                    {s.body}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ================= 4. THE ROUTE SHEET ====================
          For the reader who cannot pick a card off the wall. Split layout: the
          question on the left, the five routes ruled down the right, each
          printed as the chain of departments it actually walks through. */}
      <section id="paths">
        <div className="nb-wrap grid gap-[clamp(1.6rem,4vw,3.2rem)] py-[clamp(2.6rem,5vw,4.4rem)] lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.35fr)]">
          <div>
            <h2 className="max-w-[14ch]">Not sure which one is yours?</h2>
            <p className="nb-sub mt-4">
              Each route strings several departments together in the order a
              real team learns them, so you always know what comes next.
            </p>
            <Link href="/paths" className="nb-btn-ghost mt-6">
              All paths
            </Link>
          </div>

          <ul className="flex flex-col">
            {PATHS.map((p, i) => (
              <li key={p.slug}>
                <Link
                  href={`/paths/${p.slug}`}
                  className={`group block no-underline ${
                    i > 0 ? "nb-hair mt-5 pt-5" : ""
                  }`}
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <h3 className="group-hover:underline group-hover:decoration-blue group-hover:decoration-2 group-hover:underline-offset-4">
                      {p.title}
                    </h3>
                    <span className="nb-slug shrink-0">
                      {p.steps.length} departments
                    </span>
                  </div>
                  {/* The chain is the content: it is what tells you whether a
                      route covers the part of the team you are on. */}
                  <p className="nb-slug mt-2 break-words">
                    {p.steps.map((s) => s.deptSlug).join("  /  ")}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ================ 5. THE PIT CHECKLIST ===================
          The carbon-copy log. Symptom in the left column because that is the
          thing someone is scanning for with forty minutes on the clock. */}
      <section id="pit" className="nb-rule">
        <div className="nb-wrap py-[clamp(2.6rem,5vw,4.4rem)]">
          <p className="nb-marker">pit checklist / {PIT_FIXES.length} entries</p>
          <h2 className="max-w-[26ch]">
            When the robot dies forty minutes before your match.
          </h2>
          <p className="nb-sub mt-4">
            Each of these starts at the most likely cause and works down the
            list, because in the pit nobody has time to read a survey of the
            problem space.
          </p>

          <div className="nb-list mt-[clamp(1.4rem,3vw,2.2rem)]">
            {PIT_FIXES.map((f) => (
              <Link key={f.href} href={f.href} className="nb-row">
                <span className="nb-slug">{f.symptom}</span>
                <h3>{f.title}</h3>
                <span className="nb-slug">read it</span>
              </Link>
            ))}
          </div>

          <div className="mt-[clamp(1.4rem,2.8vw,2rem)]">
            <Link href="/blog" className="nb-btn-ghost">
              All articles
            </Link>
          </div>
        </div>
      </section>

      {/* ================== 6. THE CALCULATORS ===================
          A reference table, ruled into one card. What you give it and what it
          gives back are the whole value, so both get a column. */}
      <section id="tools" className="nb-rule">
        <div className="nb-wrap py-[clamp(2.6rem,5vw,4.4rem)]">
          <h2>Calculators that get the numbers right.</h2>
          <p className="nb-sub mt-4">
            Each one shows its working, so the answer is something you can put
            in front of a mentor and defend.
          </p>

          <div className="nb-box mt-[clamp(1.4rem,3vw,2.2rem)] p-[clamp(1.1rem,2.4vw,1.8rem)]">
            <div className="nb-scroll">
              <table className="nb-table min-w-[38rem]">
                <caption className="sr-only">
                  The five LearnFRC calculators, what each one takes as input,
                  and what it returns.
                </caption>
                <thead>
                  <tr>
                    <th scope="col">calculator</th>
                    <th scope="col">what you give it</th>
                    <th scope="col">what it tells you</th>
                  </tr>
                </thead>
                <tbody>
                  {TOOLS.map((t) => (
                    <tr key={t.href}>
                      <td className="font-semibold">
                        {/* inline-block + py-3 lifts the hit area to 45px. An
                            inline link here is only 21px tall, under the 44px
                            floor, and a table cell cannot carry the target
                            itself. */}
                        <Link href={t.href} className="nb-link inline-block py-3">
                          {t.name}
                        </Link>
                      </td>
                      <td className="text-graphite">{t.input}</td>
                      <td>{t.output}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-[clamp(1.2rem,2.4vw,1.8rem)]">
            <Link href="/tools" className="nb-btn-ghost">
              All tools
            </Link>
          </div>
        </div>
      </section>

      {/* ======================= 7. PROOF ========================
          Named teams (written permission only) and measured aggregates. The
          quote slot inside stays empty until a real reply arrives. */}
      <div className="nb-rule">
        <SocialProof />
      </div>

      {/* ======================= 8. CLOSE ========================
          One card, taped down, never straightened. Same two labels as the hero
          so the page only ever asks for two things. */}
      <section className="nb-rule">
        <div className="nb-wrap py-[clamp(2.6rem,5vw,4.4rem)]">
          <div className="nb-box nb-tilt-4 grid gap-[clamp(1.2rem,3vw,2.4rem)] p-[clamp(1.4rem,3vw,2.4rem)] lg:grid-cols-[minmax(0,1.4fr)_minmax(0,0.7fr)] lg:items-center">
            <span
              aria-hidden="true"
              className="nb-tape -top-3 left-[38%] rotate-[-2.8deg]"
            />
            <div>
              <h2 className="max-w-[18ch]">Start with one lesson.</h2>
              <p className="nb-sub mt-4">
                Reading needs no account. Make one when you want the quizzes to
                count toward a certificate, and your progress to survive the
                walk back to the shop.
              </p>
            </div>
            <div className="flex flex-col gap-3 lg:border-l lg:border-dashed lg:border-l-[var(--rule)] lg:pl-[clamp(1.2rem,3vw,2.2rem)]">
              <Link href="/signup" className="nb-btn">
                Start learning
              </Link>
              <Link href="/guides" className="nb-btn-ghost">
                Browse the departments
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
