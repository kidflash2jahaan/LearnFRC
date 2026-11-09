import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { classEligibility, eligibilitySentence, listUpcomingClasses } from "@/lib/app/classes";
import { getTeacher } from "@/lib/app/class-teachers";
import { classesConfigured, classesVisible } from "@/lib/classes/config";
import { PUBLIC_CONTACT_EMAIL } from "@/lib/email";
import { ClassCard } from "@/components/classes/class-card";
import { ClassDayList } from "./_day-list";

export const metadata: Metadata = {
  title: "Live classes",
  description:
    "Free live online classes on LearnFRC lessons, taught by FRC students. 15 to 90 minutes, recorded on video and reviewed, with student cameras off and a filtered class chat.",
  alternates: { canonical: "/classes" },
};

/**
 * Live classes, the listing (classes-design.md section 11).
 *
 * Nothing here exists until both switches are on (classesVisible): the page
 * answers 404, like every other class route, so a trace of classes can't
 * reach the live site before launch.
 *
 * WHO TAUGHT IT. listUpcomingClasses (src/lib/app/classes.ts, the same
 * function the app's GET /api/app/classes calls) fills in the teacher's
 * @handle only for a signed-in viewer and drops classes taught by anyone
 * blocked either way. Signed out, every row says "Taught by an FRC student",
 * and the HTML carries no handle at all. Never a team number.
 *
 * TIMES. Rows and day headings are in Pacific time on the server and switch
 * to the reader's own zone after hydration (LocalTime, ClassDayList).
 *
 * Dynamic on purpose: while classes are hidden the page 404s before it reads
 * the session, so without this the build prerenders that 404 as a static
 * page, which would outlive the switch being turned on.
 */
export const dynamic = "force-dynamic";

async function viewerOf() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user ?? null;
  } catch {
    return null;
  }
}

const FACTS: { slug: string; text: string }[] = [
  { slug: "who teaches", text: "FRC students aged 13 to 17 who know a topic well, on a LearnFRC lesson or module." },
  { slug: "cost", text: "Free. No ads, nothing to buy, the same as the lessons." },
  { slug: "length", text: "15 to 90 minutes, up to 15 students in each class." },
  {
    slug: "recorded",
    text: "Every class is recorded on video and transcribed, and LearnFRC reviews every one afterwards.",
  },
  { slug: "cameras", text: "Student cameras stay off and can't be turned on. Students can unmute to ask questions." },
  {
    slug: "chat",
    text: "One class chat, no private messages. It won't send links outside LearnFRC and the docs, @handles, emails, phone numbers or other apps' usernames.",
  },
  { slug: "names", text: "Everyone in a class sees each other's LearnFRC usernames. Visitors who aren't signed in never do." },
];

export default async function ClassesPage() {
  if (!(await classesVisible())) notFound();

  const viewer = await viewerOf();
  const [list, state, teacher] = await Promise.all([
    listUpcomingClasses({ viewer }),
    viewer ? classEligibility(viewer) : Promise.resolve(null),
    viewer ? getTeacher(viewer.id) : Promise.resolve(null),
  ]);
  const signedIn = !!viewer;
  const live = list.classes.filter((c) => c.status === "live");
  const upcoming = list.classes.filter((c) => c.status !== "live");
  const configured = classesConfigured();

  // A signed-in reader who can't sign up yet hears why once, here, with the
  // way forward, instead of finding out on a class page.
  const statusNote =
    state && state !== "ready" && state !== "hidden" && state !== "signed_out" ? eligibilitySentence(state) : null;
  const statusLink =
    state === "needs_handle"
      ? { href: "/settings", label: "Pick a username" }
      : state === "needs_age" || state === "needs_parent"
        ? { href: "/classes/ready", label: "Get set up" }
        : state === "waiting_parent"
          ? { href: "/classes/ready", label: "Check on it" }
          : null;

  return (
    <div className="nb-wrap py-[clamp(2.2rem,5vw,3.8rem)]">
      <header className="max-w-[52rem]">
        <p className="nb-marker">classes / live</p>
        <h1 className="text-[clamp(2.2rem,1.2rem+3.4vw,3.4rem)]">
          Learn it <span className="nb-mark">live</span>, from FRC students.
        </h1>
        <p className="nb-lede mt-5">
          Free live online classes on LearnFRC lessons, taught by students on FRC teams. Pick a class,
          sign up, and join from this site when it starts.
        </p>
        <p className="nb-pen mt-5 max-w-[30ch] rotate-[-1.1deg]">no app to install, it runs in your browser</p>
      </header>

      {statusNote && (
        <div className="nb-note mt-6 max-w-[64ch]" role="status">
          <p className="nb-slug">before you join a class</p>
          <p className="mt-2 text-[0.99rem] leading-relaxed">{statusNote}</p>
          {statusLink && (
            <Link href={statusLink.href} className="nb-btn nb-btn-sm mt-4">
              {statusLink.label}
            </Link>
          )}
        </div>
      )}

      {/* ---- live now ---------------------------------------------------- */}
      {live.length > 0 && (
        <section
          aria-labelledby="live"
          className="mt-[clamp(2rem,4vw,3rem)] border-t-2 border-ink pt-[clamp(1.4rem,3vw,2.2rem)]"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
            <h2 id="live" className="text-[clamp(1.4rem,1.1rem+1.1vw,1.9rem)]">
              Live now
            </h2>
            <p className="nb-slug">
              {live.length} {live.length === 1 ? "class" : "classes"} running
            </p>
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {live.map((c) => (
              <ClassCard key={c.id} c={c} showTeacher={signedIn} />
            ))}
          </div>
        </section>
      )}

      {/* ---- upcoming, by day -------------------------------------------- */}
      <section
        aria-labelledby="upcoming"
        className="mt-[clamp(2rem,4vw,3rem)] border-t-2 border-ink pt-[clamp(1.4rem,3vw,2.2rem)]"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
          <h2 id="upcoming" className="text-[clamp(1.4rem,1.1rem+1.1vw,1.9rem)]">
            Upcoming classes
          </h2>
          <p className="nb-slug">times in your time zone</p>
        </div>

        {upcoming.length > 0 ? (
          <div className="mt-5">
            <ClassDayList classes={upcoming} showTeacher={signedIn} />
          </div>
        ) : (
          <div className="nb-box nb-tilt-2 mt-6 max-w-[40rem] p-[clamp(1.1rem,2.6vw,1.8rem)]">
            <span className="nb-tape -top-3 left-[18%] rotate-[-2.8deg]" aria-hidden="true" />
            <p className="nb-slug">{configured ? "nothing on the calendar yet" : "classes open soon"}</p>
            <p className="mt-3 max-w-[54ch] text-[0.99rem] leading-relaxed">
              {configured
                ? "The first classes are being scheduled. Check back soon, or teach one yourself."
                : "Classes open soon. The first ones are being set up now."}
            </p>
            <Link href="/apply/teach" className="nb-btn mt-5">
              Want to teach one?
            </Link>
          </div>
        )}
      </section>

      {/* ---- what a class is --------------------------------------------- */}
      <section
        aria-labelledby="what"
        className="mt-[clamp(2.4rem,5vw,3.6rem)] max-w-[52rem] border-t-2 border-ink pt-[clamp(1.4rem,3vw,2.2rem)]"
      >
        <h2 id="what" className="text-[clamp(1.4rem,1.1rem+1.1vw,1.9rem)]">
          What a class is like
        </h2>
        <dl className="mt-5">
          {FACTS.map((f) => (
            <div
              key={f.slug}
              className="grid gap-x-[clamp(1rem,3vw,2.4rem)] gap-y-1 border-t border-dashed border-rule py-4 sm:grid-cols-[minmax(0,11rem)_minmax(0,1fr)]"
            >
              <dt className="nb-slug font-bold text-ink">{f.slug}</dt>
              <dd className="text-[0.99rem] leading-relaxed text-graphite">{f.text}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* ---- teach ------------------------------------------------------- */}
      <section
        aria-labelledby="teach"
        className="mt-[clamp(2.4rem,5vw,3.6rem)] max-w-[52rem] border-t-2 border-ink pt-[clamp(1.4rem,3vw,2.2rem)]"
      >
        <h2 id="teach" className="text-[clamp(1.4rem,1.1rem+1.1vw,1.9rem)]">
          Teach a class
        </h2>
        <div className="mt-4 flex max-w-[64ch] flex-col gap-4 text-[0.99rem] leading-relaxed text-graphite">
          <p>
            Teachers are FRC students aged 13 to 17 who know a topic well. Once you&rsquo;re accepted,
            you schedule classes on any LearnFRC lesson or module, for up to 15 students each. Every
            class is recorded on video and reviewed, the first one included.
          </p>
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-3">
          {teacher ? (
            <Link href="/classes/teaching" className="nb-btn">
              Your teaching page
            </Link>
          ) : (
            <Link href="/apply/teach" className="nb-btn">
              Apply to teach
            </Link>
          )}
        </div>
      </section>

      {/* ---- questions --------------------------------------------------- */}
      <section
        aria-labelledby="faq"
        className="mt-[clamp(2.4rem,5vw,3.6rem)] max-w-[52rem] border-t-2 border-ink pt-[clamp(1.4rem,3vw,2.2rem)]"
      >
        <h2 id="faq" className="text-[clamp(1.4rem,1.1rem+1.1vw,1.9rem)]">
          Questions
        </h2>
        <div className="mt-5 flex flex-col gap-6">
          <div>
            <h3 className="text-[1.08rem]">How do I join?</h3>
            {/* Neutral on purpose (design section 5): nothing before the
                one-time question says what answer it's looking for. */}
            <p className="mt-2 max-w-[64ch] text-[0.99rem] leading-relaxed text-graphite">
              You need a free LearnFRC account with a username. The first time you sign up for a
              class, we ask one quick question, and a parent or guardian says OK by email. Every lesson
              stays free to read either way.
            </p>
          </div>
          <div>
            <h3 className="text-[1.08rem]">How do you keep classes safe?</h3>
            <p className="mt-2 max-w-[64ch] text-[0.99rem] leading-relaxed text-graphite">
              Every class is recorded on video and transcribed, and LearnFRC reviews every one
              afterwards, with help from an AI that writes notes on each class. Student cameras stay
              off, there&rsquo;s no private messaging, and the class chat blocks contact details. Anyone
              in a class can press Report, and LearnFRC&rsquo;s adult volunteer safety lead looks at
              anything flagged. Teachers can mute and remove people, and LearnFRC can end any class.
            </p>
          </div>
          <div>
            <h3 className="text-[1.08rem]">I&rsquo;m a parent. What should I know?</h3>
            <p className="mt-2 max-w-[64ch] text-[0.99rem] leading-relaxed text-graphite">
              You get one email about classes before your teen can join, and you decide. It explains
              the recording, who sees what, and how to change your mind. Recordings are deleted after 7
              days unless there&rsquo;s a safety problem. The details are in the{" "}
              <Link href="/privacy#classes" className="nb-link">
                privacy policy
              </Link>
              , and you can write to {PUBLIC_CONTACT_EMAIL} with any question.
            </p>
          </div>
          <div>
            <h3 className="text-[1.08rem]">Can teachers get service hours?</h3>
            <p className="mt-2 max-w-[64ch] text-[0.99rem] leading-relaxed text-graphite">
              Teachers can ask for a letter listing their teaching time, signed by LearnFRC&rsquo;s
              volunteer coordinator. Only classes LearnFRC has reviewed and approved count. Check your
              school&rsquo;s rules first: some don&rsquo;t count online service, and some need a
              registered nonprofit or an adult at every session.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
