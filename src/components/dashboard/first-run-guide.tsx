import Link from "next/link";

/**
 * The only surface a zero-progress learner meets on the dashboard.
 *
 * 45% of accounts never finish a single lesson, and the loss is entirely
 * upstream of the content: a new learner lands on a page built for someone with
 * a history and is handed 394 lessons across 11 departments with no default.
 * This replaces the choice with one action, and sets the come-back-tomorrow
 * expectation, which are the two things that move day-one retention.
 *
 * Numbered because it genuinely is a sequence: read, quiz, return. The rules
 * above the steps are the ledger rules the whole binder uses, so the three
 * steps read as an ordered list rather than as three feature cards.
 *
 * Server Component. Nothing here has state.
 */

const STEPS = [
  {
    n: "step one",
    title: "Finish one lesson",
    body: "One topic, about five minutes. Nothing is gated, so you can read it on the shop floor.",
  },
  {
    n: "step two",
    title: "Pass the quiz",
    body: "It checks the thing that actually breaks robots, not the vocabulary word you skimmed. Retakes are unlimited.",
  },
  {
    n: "step three",
    title: "Come back tomorrow",
    body: "One a day builds a streak, and a streak multiplies the XP every lesson pays out.",
  },
];

export function FirstRunGuide({
  href,
  lessonTitle,
  deptName,
}: {
  href: string;
  lessonTitle: string;
  deptName: string;
}) {
  return (
    <section
      aria-labelledby="first-run-heading"
      className="nb-box nb-tilt-3 p-[clamp(1.2rem,2.8vw,2rem)]"
    >
      <span className="nb-tape -top-3 left-[14%] rotate-[-3.2deg]" aria-hidden="true" />

      <p className="nb-marker">new here</p>

      <h2 id="first-run-heading" className="max-w-[20ch] text-[clamp(1.4rem,1.1rem+1.2vw,2.1rem)]">
        The whole loop takes five minutes.
      </h2>

      <p className="nb-sub mt-3">
        You do not have to pick a department to start. Read one lesson, answer
        the quiz at the end of it, and the account starts keeping score.
      </p>

      <ol className="mt-[clamp(1.3rem,2.6vw,1.9rem)] grid gap-[clamp(0.9rem,2.2vw,1.5rem)] min-[720px]:grid-cols-3">
        {STEPS.map((s) => (
          <li key={s.title} className="border-t-2 border-ink pt-3">
            <p className="nb-slug">{s.n}</p>
            <h3 className="mt-1.5 text-[1.02rem] leading-tight">{s.title}</h3>
            <p className="mt-1.5 text-[0.9rem] leading-snug text-graphite">
              {s.body}
            </p>
          </li>
        ))}
      </ol>

      <div className="nb-hair mt-[clamp(1.3rem,2.6vw,1.9rem)] pt-4">
        <Link href={href} className="nb-btn">
          Start with this one
        </Link>
        <p className="nb-slug mt-2.5">
          {lessonTitle} / {deptName}
        </p>
      </div>
    </section>
  );
}
