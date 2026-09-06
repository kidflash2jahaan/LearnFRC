import Link from "next/link";
import { redirect } from "next/navigation";
import { DEPT_CATALOG } from "@/lib/dept-catalog";
import { AuthForm } from "@/components/auth/auth-form";
import { getSession } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata = {
  title: "Sign up",
  description:
    "Create your free LearnFRC account and start mastering FIRST Robotics.",
  robots: { index: false, follow: true },
};

/**
 * The three figures that answer "what am I signing up to". Printed on the one
 * inverted surface in the system, because on a page whose job is persuasion
 * the numbers are the argument and they should read from across the room.
 * `0` is deliberately a figure and not a sentence: it is the only one of the
 * three anybody is sceptical about.
 */
const STAMPS = [
  { figure: "11", caption: "departments, one per job on a team" },
  { figure: "394", caption: "lessons, readable right now" },
  { figure: "0", caption: "paywalls, trials or card fields" },
];

/**
 * SIGN UP — the roster page at the front of the binder.
 *
 * Read top to bottom rather than side to side, which is the whole difference
 * between this page and /login. A rookie arriving here has not decided yet, so
 * the page is three bands in the order the decision gets made: fill it in,
 * here is what it costs, here is everything that is inside. The blue slab is
 * the one inverted surface in this half of the site and it appears exactly
 * once, on the band that carries the argument.
 *
 * The old page put eleven coloured department tiles beside the form. In this
 * system a department has no colour, so the contents page is what it is on
 * paper: a ruled index, two columns, slug and name.
 *
 * BEHAVIOUR IS UNCHANGED: same session redirect, same `next` sanitising, same
 * `ref` normalising and the same admin lookup that turns a referral code into
 * a real username so the invite is not a cold form.
 */
export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; ref?: string; via?: string }>;
}) {
  const { next, ref, via } = await searchParams;
  const { user } = await getSession();
  if (user) redirect("/dashboard");

  const safeNext = next && next.startsWith("/") ? next : undefined;
  const refValue =
    (ref || "").toLowerCase().replace(/[^a-z0-9_]/g, "") || undefined;

  // If they arrived via a referral link, resolve the referrer so we can show
  // real social proof ("@jane put you on the roster") instead of a cold form.
  // refValue is the referrer's username: referral links are /signup?ref=<username>.
  let referrer: { username: string; team_number: string | null } | null = null;
  if (refValue) {
    const admin = createAdminClient();
    const { data: r } = await admin
      .from("profiles")
      .select("username, team_number")
      .eq("username", refValue)
      .maybeSingle();
    if (r?.username)
      referrer = {
        username: r.username as string,
        team_number: (r.team_number as string) ?? null,
      };
  }

  return (
    <>
      {/* ── Band 1: the ask, and the form directly under it ───────────── */}
      <section className="nb-wrap py-[clamp(2.4rem,5vw,4.2rem)]">
        <div className="max-w-[36rem]">
          <p className="nb-marker">{referrer ? "invited" : "new account"}</p>

          {referrer ? (
            <>
              {/* A username is an identifier, so it is set in Space Mono even
                  here. It rides at 0.9em of the display size rather than the
                  slug's own 0.78rem, which would read as a footnote dropped
                  into a headline. */}
              <h1 className="max-w-[15ch]">
                <span className="nb-slug text-[0.9em] text-blue">
                  @{referrer.username}
                </span>{" "}
                put you on the roster.
              </h1>
              <p className="nb-lede mt-[clamp(0.9rem,2vw,1.3rem)]">
                Take the seat and you both get 25 XP the moment you confirm your
                email.
                {referrer.team_number
                  ? ` They build on Team ${referrer.team_number}.`
                  : ""}{" "}
                It stays free either way.
              </p>
            </>
          ) : (
            <>
              <h1 className="max-w-[14ch]">
                Put your name on the <span className="nb-mark">roster</span>.
              </h1>
              <p className="nb-lede mt-[clamp(0.9rem,2vw,1.3rem)]">
                One account covers every department. It keeps count of what
                you&rsquo;ve passed, so you never have to remember where you
                stopped, and it prints your certificate when a department is
                done.
              </p>
            </>
          )}
        </div>

        <div className="relative mt-[clamp(1.6rem,3.5vw,2.4rem)] max-w-[36rem]">
          <div className="nb-box nb-tilt-2 p-[clamp(1.15rem,2.6vw,1.8rem)]">
            <span className="nb-tape -top-3 left-[26%] rotate-[2.8deg]" aria-hidden="true" />

            <p className="nb-slug border-b border-dashed border-rule pb-3">
              roster entry
            </p>

            <div className="mt-5">
              <AuthForm
                mode="signup"
                next={safeNext}
                referrer={refValue}
                via={via}
              />
            </div>
          </div>

          {/* Pinned in the margin on wide screens, tucked underneath on narrow
              ones, the way a note written after the fact ends up wherever
              there was room for it. */}
          <p className="nb-pen mt-5 max-w-[24ch] rotate-[-1.4deg] xl:absolute xl:left-[calc(100%+2.6rem)] xl:top-16 xl:mt-0">
            takes about a minute. the team number is optional, add it later if
            you don&rsquo;t know it.
          </p>
        </div>
      </section>

      {/* ── Band 2: the argument, stamped on the one inverted surface ─── */}
      <section className="nb-slab py-[clamp(2.2rem,4.5vw,3.4rem)]">
        <div className="nb-wrap grid gap-[clamp(1.4rem,3vw,2.6rem)] sm:grid-cols-3">
          {STAMPS.map((s) => (
            <p className="nb-stamp" key={s.figure}>
              <b>{s.figure}</b>
              <span>{s.caption}</span>
            </p>
          ))}
        </div>
      </section>

      {/* ── Band 3: the contents page ─────────────────────────────────── */}
      <section className="nb-wrap py-[clamp(2.4rem,5vw,4rem)]">
        <p className="nb-marker">what the account opens</p>
        <h2 className="max-w-[18ch]">Every department, from day one.</h2>
        <p className="nb-sub mt-3">
          Nothing is staged behind a level or a streak. The account exists to
          count what you&rsquo;ve read, hand you a certificate at the end of a
          department, and put you on your team&rsquo;s page.
        </p>

        <ul className="nb-list mt-[clamp(1.4rem,3vw,2.2rem)] grid sm:grid-cols-2 sm:gap-x-[clamp(1.5rem,4vw,3.5rem)]">
          {DEPT_CATALOG.map((d) => (
            <li
              key={d.slug}
              className="grid gap-0.5 border-b border-dashed border-rule py-3.5"
            >
              <span className="nb-slug">dept / {d.slug}</span>
              <span className="text-[0.98rem] font-medium leading-snug">
                {d.name}
              </span>
            </li>
          ))}
        </ul>

        <p className="mt-[clamp(1.4rem,3vw,2rem)]">
          <Link href="/guides" className="nb-btn-ghost">
            Open the guides first
          </Link>
        </p>
      </section>
    </>
  );
}
