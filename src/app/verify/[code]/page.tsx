import type { ReactNode } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { classesVisible } from "@/lib/classes/config";
import { COORDINATOR } from "@/lib/classes/coordinator";
import { verifyHoursLetter } from "@/lib/classes/letters";
import { hoursAndMinutes, longDate, shortDate } from "@/lib/classes/letter-rules";

export const metadata: Metadata = {
  title: "Verify a letter",
  robots: { index: false, follow: false },
};

/**
 * /verify/[code]: the public check for an hours letter (classes-design.md
 * section 9.2 step 5). "Valid letter" with the letter's facts, "Withdrawn on
 * <date>", or "We can't find that letter". Rate-limited to 30 checks an hour
 * per address (verifyHoursLetter), and codes come from a 30-symbol alphabet,
 * 10 places long, so guessing one isn't practical.
 *
 * A signed letter keeps verifying even if classes are switched off later,
 * since a school may check it months after it was handed in. Anything else
 * answers 404 while classes are hidden, so nothing about classes shows on
 * the site before launch (section 1). Calling headers() for the rate limit
 * makes the route dynamic.
 */

function Frame({ marker, children }: { marker: string; children: ReactNode }) {
  return (
    <section className="nb-wrap pb-[clamp(3rem,6vw,5rem)] pt-[clamp(2rem,5vw,3.4rem)]">
      <div className="mx-auto max-w-[46rem]">
        <p className="nb-marker">{marker}</p>
        {children}
      </div>
    </section>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="nb-slug">{label}</p>
      <p className="mt-0.5 break-words text-[1rem] font-bold leading-snug">{children}</p>
    </div>
  );
}

export default async function VerifyLetterPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const result = await verifyHoursLetter(code);

  if ((result.state === "not_found" || result.state === "rate_limited") && !(await classesVisible())) notFound();

  if (result.state === "rate_limited") {
    return (
      <Frame marker="verify / slow down">
        <h1 className="text-[clamp(1.9rem,1.3rem+2vw,2.8rem)]">Too many checks from here.</h1>
        <p className="nb-lede mt-4">Try again in an hour. Each address can check 30 letters an hour.</p>
      </Frame>
    );
  }

  if (result.state === "not_found") {
    return (
      <Frame marker="verify / not found">
        <h1 className="text-[clamp(1.9rem,1.3rem+2vw,2.8rem)]">We can&rsquo;t find that letter.</h1>
        <p className="nb-lede mt-4 max-w-[56ch]">
          Check the code against the one printed at the bottom of the letter. It looks like LF-XXXXX-XXXXX.
        </p>
      </Frame>
    );
  }

  if (result.state === "withdrawn") {
    return (
      <Frame marker="verify / withdrawn">
        <div className="nb-box p-[clamp(1.3rem,3vw,2rem)]">
          <p className="nb-slug">letter {result.code}</p>
          <h1 className="mt-2 text-[clamp(1.9rem,1.3rem+2vw,2.8rem)]">Withdrawn on {longDate(result.revokedOn)}.</h1>
          <p className="mt-3 text-graphite">
            LearnFRC withdrew this letter, so it isn&rsquo;t valid any more. Don&rsquo;t count the hours it lists.
          </p>
        </div>
      </Frame>
    );
  }

  const l = result.letter;
  return (
    <Frame marker="verify / valid">
      <div className="nb-box p-[clamp(1.3rem,3vw,2rem)]">
        <p className="nb-slug">letter {l.code}</p>
        <h1 className="mt-2 text-[clamp(1.9rem,1.3rem+2vw,2.8rem)]">Valid letter.</h1>
        <p className="mt-3 max-w-[56ch] text-graphite">
          LearnFRC issued this letter, and it hasn&rsquo;t been withdrawn. The facts below are what it should say.
        </p>

        <div className="nb-rule mt-5 grid gap-x-8 gap-y-4 pt-4 sm:grid-cols-2">
          <Fact label="name">{l.letterName}</Fact>
          <Fact label="issued">{longDate(l.issuedOn)}</Fact>
          <Fact label="period">
            {longDate(l.start)} to {longDate(l.end)}
          </Fact>
          <Fact label="teaching time">
            {hoursAndMinutes(l.totalMinutes)}, {l.classCount} {l.classCount === 1 ? "class" : "classes"}
          </Fact>
          <Fact label="signed by">
            {l.coordinatorName}, {COORDINATOR.letterTitle}
          </Fact>
          <Fact label="contact">
            <a href={`mailto:${l.coordinatorEmail}`} className="nb-link">
              {l.coordinatorEmail}
            </a>
          </Fact>
        </div>

        <div className="nb-scroll mt-6">
          <table className="nb-table min-w-[30rem]">
            <thead>
              <tr>
                <th scope="col">date</th>
                <th scope="col">class</th>
                <th scope="col">topic</th>
                <th scope="col" className="text-right">
                  minutes
                </th>
              </tr>
            </thead>
            <tbody>
              {l.classes.map((c) => (
                <tr key={c.classId}>
                  <td className="whitespace-nowrap">{shortDate(c.date)}</td>
                  <td>{c.title}</td>
                  <td className="text-graphite">{c.topic ?? ""}</td>
                  <td className="text-right">{c.minutes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="nb-hint mt-5 max-w-[60ch]">
        Minutes count only while the teacher was teaching and at least one student was in the room, for classes
        LearnFRC recorded, reviewed and approved.{" "}
        <Link href="/classes" className="nb-link">
          About LearnFRC classes
        </Link>
        .
      </p>
    </Frame>
  );
}
