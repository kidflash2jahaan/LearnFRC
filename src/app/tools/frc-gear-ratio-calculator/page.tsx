import type { Metadata } from "next";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { JsonLd } from "@/components/json-ld";
import { ToolCTA } from "@/components/tools/tool-cta";
import Calculator from "./_calculator";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://learnfrc.com";

export const metadata: Metadata = {
  title: "FRC Gear Ratio Calculator — Speed, Torque & Pushing Force",
  description:
    "Free FRC gear ratio calculator. Enter your motor, gear stages, wheel size and current limit to get overall reduction, free and adjusted speed, wheel torque, pushing force vs the traction limit, and a brownout check — with every formula shown. Motor specs verified against REV, CTRE, WCP and AndyMark.",
  alternates: { canonical: `${SITE}/tools/frc-gear-ratio-calculator` },
  openGraph: {
    images: [{ url: `${SITE}/opengraph-image`, width: 1200, height: 630 }],
    title: "FRC Gear Ratio Calculator (Free) — LearnFRC",
    description:
      "Overall reduction, free vs adjusted speed, wheel torque, pushing force and brownout risk — with the math shown. NEO, Kraken, Falcon and CIM specs included.",
    url: `${SITE}/tools/frc-gear-ratio-calculator`,
    type: "website",
  },
};

/* FAQ content lives here so the visible copy and the FAQPage schema can
   never drift apart — the same array renders both. */
const FAQS: { q: string; a: string }[] = [
  {
    q: "How do you calculate a gear ratio for an FRC robot?",
    a: "A single reduction is the driven gear's tooth count divided by the driving gear's: a 14-tooth pinion into a 50-tooth gear is 50 ÷ 14 = 3.571:1. When stages are stacked, multiply them — the KOP ToughBox Mini's 8.45:1 is really (50 ÷ 14) × (45 ÷ 19) = 8.459. Output speed is motor free speed divided by that number, and output torque is motor torque multiplied by it, minus efficiency losses.",
  },
  {
    q: "What gear ratio should an FRC drivetrain use?",
    a: "There is no single right answer, because the ratio only matters relative to your wheel size, motor count and current limit. Most competitive robots end up geared for roughly 12 to 17 ft/s of free speed, and the useful test is not the ratio itself but whether the calculator says you are traction-limited or torque-limited. If your wheels can already push harder than the carpet will hold, more reduction buys you nothing but a slower robot.",
  },
  {
    q: "What is the difference between free speed and adjusted speed?",
    a: "Free speed is exact kinematics — motor no-load RPM divided by the reduction, times the wheel circumference — and assumes the robot is pushing against nothing. Adjusted speed multiplies that by roughly 0.8 to 0.85 to allow for rolling resistance, gearbox drag and wheel scrub. That derate is a long-standing FRC design-calculator convention rather than a derivation, which is why this tool exposes it as an editable field instead of burying it.",
  },
  {
    q: "Does gearbox efficiency slow my robot down?",
    a: "Barely. Efficiency losses eat torque, not free speed, so a 90% efficient gearbox gives you about 90% of the pushing force but very nearly the same top speed. That is why this calculator applies efficiency to the torque and force outputs but not to free speed. A rough rule is 95% per spur-gear mesh and 97% per chain or belt run, so a two-stage gearbox is about 90% and a three-stage swerve module about 86%.",
  },
  {
    q: "Why does my robot brown out when it pushes another robot?",
    a: "Pushing puts the drive motors near stall, which is exactly where they draw the most current. Four motors at a 40 A limit is 160 A, already past the 120 A main breaker, and that current pulls the bus voltage down by roughly current times the battery's internal resistance. Once the bus reaches about 6.75 V the roboRIO starts disabling outputs. Lowering per-motor current limits is usually a better fix than a new battery.",
  },
  {
    q: "What gear ratio should I use for an FRC arm?",
    a: "Work backwards from holding torque. Estimate the torque your arm needs at its worst case — arm weight plus game piece, times the horizontal distance to its centre of mass — then pick a reduction that produces it at a current your motor can hold without cooking. Switch this calculator to Mechanism mode and enter your lever radius to see the force at the end of the arm. Also check that the ratio is high enough not to back-drive when disabled.",
  },
];

export default async function Page() {
  const { user } = await getSession();
  return (
    <main className="relative mx-auto max-w-6xl px-4 pb-20 pt-28 sm:px-6 lg:px-8 lg:pt-32">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "WebApplication",
          name: "FRC Gear Ratio Calculator",
          applicationCategory: "UtilityApplication",
          operatingSystem: "Web",
          url: `${SITE}/tools/frc-gear-ratio-calculator`,
          description:
            "Free FRC gear ratio calculator — overall reduction, free and adjusted speed, wheel torque, pushing force against the traction limit, and a current-draw brownout check, with every formula shown.",
          offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
          publisher: { "@type": "Organization", name: "LearnFRC", url: SITE },
        }}
      />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: SITE },
            { "@type": "ListItem", position: 2, name: "Tools", item: `${SITE}/tools` },
            {
              "@type": "ListItem",
              position: 3,
              name: "Gear Ratio Calculator",
              item: `${SITE}/tools/frc-gear-ratio-calculator`,
            },
          ],
        }}
      />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: FAQS.map((f) => ({
            "@type": "Question",
            name: f.q,
            acceptedAnswer: { "@type": "Answer", text: f.a },
          })),
        }}
      />

      <Calculator authed={!!user} />

      {/* ------------------------------ EXPLAINER ------------------------------ */}
      <section className="mt-14 max-w-3xl">
        <span className="ac-chip inline-flex items-center gap-2">
          <span className="ac-eyebrow">The theory behind the numbers</span>
        </span>
        <h2 className="mt-4 text-balance font-display text-2xl font-bold tracking-tight sm:text-3xl">
          How FRC gear ratios actually work
        </h2>

        <div className="mt-6 space-y-4 text-[15px] leading-relaxed text-foreground/75">
          <p>
            A gearbox is a trade, and only a trade. It cannot create power — it
            can only convert the power a motor already makes from one shape into
            another. Reduce by 10:1 and the output shaft turns a tenth as fast
            and delivers about ten times the torque. That is the whole idea, and
            almost every drivetrain argument your team will have is really an
            argument about where on that trade you want to sit.
          </p>
          <p>
            One reduction is just the driven gear&apos;s tooth count over the
            driving gear&apos;s. A 14-tooth pinion turning a 50-tooth gear is
            50 ÷ 14, or 3.571:1. Stack stages and you multiply them: the KOP
            ToughBox Mini that everyone calls &ldquo;8.45:1&rdquo; is really a
            14T into 50T followed by a 19T into 45T, which works out to 8.459.
            Chain and belt runs count exactly the same way — sprocket teeth over
            sprocket teeth — so a 12T to 36T chain run is another 3:1 on top of
            whatever the gearbox already did.
          </p>
        </div>

        <h3 className="mt-8 font-display text-lg font-bold tracking-tight">
          Free speed is a fiction you should still calculate
        </h3>
        <div className="mt-3 space-y-4 text-[15px] leading-relaxed text-foreground/75">
          <p>
            Free speed is what you get from pure geometry: take the motor&apos;s
            no-load RPM, divide by the reduction, and multiply by the wheel
            circumference. It is exact, and your robot will never once achieve
            it. A motor only reaches free speed when it is doing no work at all,
            and a robot on carpet is always doing work — squashing tread,
            dragging bearings, scrubbing wheels sideways through every turn.
          </p>
          <p>
            So the convention is to derate. Multiplying free speed by 80–85%
            gets you a number that matches what teams actually clock on a field,
            and that is the figure worth comparing between designs. It is an
            empirical allowance, not a derivation from first principles, which
            is exactly why the calculator above puts it in an editable box
            rather than hiding it inside the result. If your robot only ever
            travels twenty feet at a stretch, you may not even reach the
            adjusted number before it is time to brake.
          </p>
          <p>
            Efficiency is a separate thing, and it is easy to double-count. Gear
            losses take torque, not speed. A 90%-efficient gearbox still spins
            its output at very nearly the full free speed with nothing attached;
            what it loses is roughly a tenth of the force you can get out of it.
            That is why the calculator applies efficiency to torque and pushing
            force but leaves free speed alone. Budget about 95% per gear mesh
            and 97% per chain or belt run — two stages lands near 90%, a
            three-stage swerve module near 86%.
          </p>
        </div>

        <h3 className="mt-8 font-display text-lg font-bold tracking-tight">
          Picking a drivetrain ratio
        </h3>
        <div className="mt-3 space-y-4 text-[15px] leading-relaxed text-foreground/75">
          <p>
            Rookie teams tend to ask &ldquo;what ratio should we use?&rdquo; when
            the useful question is &ldquo;what is currently limiting us?&rdquo;
            There are only two answers. If your gearing can generate more force
            at the wheel than friction with the carpet can hold, you are{" "}
            <strong className="text-foreground">traction-limited</strong>: the
            wheels break loose and spin, and adding reduction makes you slower
            without making you push any harder. If the carpet could hold more
            than your motors can deliver, you are{" "}
            <strong className="text-foreground">torque-limited</strong>: the
            wheels grip, the motors bog down, and more reduction genuinely does
            help.
          </p>
          <p>
            The calculator tells you which one you are, because the fix is
            completely different in each case. Traction-limited robots need
            grippier tread, more weight over the driven wheels, or simply a
            lower current limit to stop wasting energy spinning wheels.
            Torque-limited robots need more reduction, more motors, or a higher
            current limit — if the breakers can stand it. Which wheels are even
            driven matters here too, and that depends on the layout you chose;
            our guide to{" "}
            <Link
              href="/blog/frc-drivetrain-types"
              className="font-medium text-primary underline underline-offset-2"
            >
              FRC drivetrain types
            </Link>{" "}
            walks through how tank, swerve and mecanum differ on this point.
          </p>
          <p>
            One caution on the traction number: the coefficient of friction is
            not a specification anybody publishes. Community measurements put
            smooth and Colson wheels somewhere around 0.8–1.0 and nitrile or
            roughtop tread around 1.1–1.4 on FRC carpet, but that swings with
            tread wear, dust, and how the test was run. If grip is deciding your
            design, drag your actual robot across actual carpet with a luggage
            scale and use your own number.
          </p>
        </div>

        <h3 className="mt-8 font-display text-lg font-bold tracking-tight">
          Picking a mechanism ratio
        </h3>
        <div className="mt-3 space-y-4 text-[15px] leading-relaxed text-foreground/75">
          <p>
            Arms, elevators and turrets get designed backwards from drivetrains.
            With a drivetrain you usually start from a target speed; with a
            mechanism you start from the torque you need and let speed fall out
            of it. For an arm, the worst case is horizontal: torque equals the
            weight of the arm plus whatever it is carrying, times the distance
            from the pivot to the combined centre of mass. Size the reduction so
            you can produce that at a current the motor can hold continuously,
            not at its stall current — a motor held near stall turns almost all
            of its power into heat and will fade or trip within a match.
          </p>
          <p>
            Then sanity-check the speed you got. A 100:1 reduction on a NEO
            gives you about 57 RPM at the output, which is roughly a second for a
            quarter turn — fine for an arm, hopeless for a shooter. And check
            back-drive: a low reduction lets gravity spin the mechanism down when
            the robot is disabled, while a high reduction (especially a worm or a
            planetary) may hold it in place on its own. Switch the calculator to
            Mechanism mode, enter your lever radius, and read the force at the
            end of the arm directly.
          </p>
        </div>

        <h3 className="mt-8 font-display text-lg font-bold tracking-tight">
          Current limits are part of the ratio decision
        </h3>
        <div className="mt-3 space-y-4 text-[15px] leading-relaxed text-foreground/75">
          <p>
            Torque is proportional to current, so your smart-current limit sets a
            ceiling on force just as firmly as your gear ratio does. A CIM at a
            40 A limit produces only about 29% of its stall torque; a Kraken X60
            at the same limit produces about 10% of its. Doubling your reduction
            and halving your current limit can land in the same place — except
            one of those changes also halves your top speed and the other keeps
            it.
          </p>
          <p>
            Then there is the ceiling above all of that. Four drive motors at
            40 A is 160 A, already beyond the 120 A main breaker, and that is
            before the intake or the elevator moves. The breaker is thermal, so a
            momentary spike while you shove someone is fine; a sustained draw is
            not. Meanwhile every amp pulls the bus voltage down by roughly the
            battery&apos;s internal resistance times the current, and at about
            6.75 V the roboRIO starts shutting your outputs off. Add up the rest
            of the robot in the{" "}
            <Link
              href="/tools/frc-current-budget"
              className="font-medium text-primary underline underline-offset-2"
            >
              current &amp; brownout calculator
            </Link>
            , and if you are already browning out at events, work through{" "}
            <Link
              href="/guides/getting-started/common-mistakes-troubleshooting/brownouts"
              className="font-medium text-primary underline underline-offset-2"
            >
              our brownout troubleshooting lesson
            </Link>
            .
          </p>
          <p>
            If any of this was new, the long-form version — with worked examples
            and diagrams — is in{" "}
            <Link
              href="/blog/frc-gear-ratios-explained"
              className="font-medium text-primary underline underline-offset-2"
            >
              FRC gear ratios explained
            </Link>
            .
          </p>
        </div>
      </section>

      {/* ------------------------------ FAQ ------------------------------ */}
      <section className="mt-14 max-w-3xl">
        <h2 className="text-balance font-display text-2xl font-bold tracking-tight sm:text-3xl">
          Gear ratio FAQ
        </h2>
        <div className="mt-6 space-y-3">
          {FAQS.map((f) => (
            <details
              key={f.q}
              className="rounded-2xl border border-border bg-white/60 p-4"
            >
              <summary className="min-h-[44px] cursor-pointer py-1.5 text-[15px] font-semibold text-foreground">
                {f.q}
              </summary>
              <p className="mt-2 text-[15px] leading-relaxed text-foreground/75">
                {f.a}
              </p>
            </details>
          ))}
        </div>
      </section>

      <ToolCTA
        related={[
          { href: "/blog/frc-gear-ratios-explained", label: "FRC gear ratios explained" },
          { href: "/blog/frc-drivetrain-types", label: "FRC drivetrain types compared" },
          { href: "/tools/frc-current-budget", label: "Current & brownout checker" },
        ]}
      />
    </main>
  );
}
