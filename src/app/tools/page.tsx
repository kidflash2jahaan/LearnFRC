import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/json-ld";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://learnfrc.com";

export const metadata: Metadata = {
  title: "Free FRC Tools & Calculators",
  description:
    "Free interactive FRC calculators: team budget, wire gauge & voltage drop, robot tip-over stability, and current draw / brownout. Every number sourced from official FIRST and vendor specs.",
  alternates: { canonical: `${SITE}/tools` },
  openGraph: {
    title: "Free FRC Tools & Calculators — LearnFRC",
    description:
      "Team budget, wire gauge, tip-over stability, and brownout calculators for FRC teams. Free, sourced, and accurate.",
    url: `${SITE}/tools`,
    type: "website",
  },
};

/**
 * One entry per calculator.
 *
 * `ask` is the thing a person actually types into a search box, and it is what
 * this page is scanned for. The old tiles led with a coloured icon badge and a
 * department hue; in the notebook there are no per-tool colours, so a tool is
 * identified by its route slug and its question, and `gives` says what falls
 * out the other end so nobody opens a calculator to find out.
 */
const TOOLS = [
  {
    href: "/tools/frc-budget-calculator",
    slug: "frc-budget-calculator",
    tag: "fundraising",
    title: "Team Budget Calculator",
    ask: "What will the season actually cost?",
    body: "Itemise registration, the drive base, the control system, tools and travel, then print the sheet a sponsor will read.",
    gives: "grand total / per student / itemised",
    tilt: "nb-tilt-1",
    tape: true,
  },
  {
    href: "/tools/frc-gear-ratio-calculator",
    slug: "frc-gear-ratio-calculator",
    tag: "drivetrain",
    title: "Gear Ratio Calculator",
    ask: "Is this ratio fast enough, and can it still push?",
    body: "Overall reduction, free and adjusted speed, torque at the wheel, pushing force against the traction limit, and whether the draw browns you out.",
    gives: "reduction / ft per s / lbf / bus volts",
    tilt: "nb-tilt-2",
    tape: false,
  },
  {
    href: "/tools/frc-wire-gauge-calculator",
    slug: "frc-wire-gauge-calculator",
    tag: "electrical",
    title: "Wire Gauge & Voltage Drop",
    ask: "Is this wire thick enough, and is it legal?",
    body: "Round-trip voltage drop from Ohm's law, checked against the minimum gauge the manual sets for each breaker size.",
    gives: "volts dropped / % of 12 V / min AWG",
    tilt: "nb-tilt-3",
    tape: false,
  },
  {
    href: "/tools/frc-tipping-calculator",
    slug: "frc-tipping-calculator",
    tag: "drivetrain",
    title: "Tip-Over & Stability",
    ask: "How hard can we turn before two wheels lift?",
    body: "Track width, wheelbase and centre-of-gravity height give the tipping acceleration, the ramp angle, and whether you slide or tip first.",
    gives: "g before tip / tip angle / lbf of push",
    tilt: "nb-tilt-4",
    tape: true,
  },
  {
    href: "/tools/frc-current-budget",
    slug: "frc-current-budget",
    tag: "power",
    title: "Current Budget & Brownout",
    ask: "Will it brown out when everything runs at once?",
    body: "Every motor against its own branch breaker, the total against the 120 A main, and the estimated bus voltage against the roboRIO brownout line.",
    gives: "amps / breaker headroom / bus volts",
    tilt: "nb-tilt-3",
    tape: false,
  },
  {
    href: "/tools/frc-deflection-calculator",
    slug: "frc-deflection-calculator",
    tag: "mechanical",
    title: "Structural Deflection",
    ask: "Will this arm sag, or bend for good?",
    body: "Material, cross-section, span and load give the tip or centre sag, the bending stress, and a safety factor against yield.",
    gives: "inches of sag / MPa / safety factor",
    tilt: "nb-tilt-1",
    tape: false,
  },
] as const;

function ToolCard({ t }: { t: (typeof TOOLS)[number] }) {
  return (
    <Link
      href={t.href}
      className={`nb-box nb-lift group flex flex-col p-[clamp(1.1rem,2.1vw,1.7rem)] no-underline ${t.tilt}`}
    >
      {t.tape && (
        <span
          className="nb-tape -top-3 left-6 rotate-[-4deg]"
          aria-hidden="true"
        />
      )}

      <p className="nb-slug flex items-baseline justify-between gap-3">
        <span className="min-w-0 truncate">tools / {t.slug}</span>
        <span className="shrink-0">{t.tag}</span>
      </p>

      <h2 className="mt-3 text-[clamp(1.2rem,1.02rem+0.7vw,1.6rem)]">
        {t.title}
      </h2>

      <p className="mt-2.5 text-[1.02rem] font-medium leading-snug text-ink">
        {t.ask}
      </p>

      <p className="mt-2 mb-4 text-[0.93rem] leading-relaxed text-graphite">
        {t.body}
      </p>

      <div className="nb-hair mt-auto flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 pt-4">
        <span className="nb-slug">{t.gives}</span>
        <span className="nb-slug shrink-0 border-b-2 border-b-transparent text-ink group-hover:border-b-blue group-hover:text-blue">
          open
        </span>
      </div>
    </Link>
  );
}

export default function ToolsPage() {
  // Collection structured data — the six calculators as an ordered list.
  const collectionLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Free FRC tools & calculators",
    itemListElement: TOOLS.map((t, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: `${SITE}${t.href}`,
      name: t.title,
    })),
  };

  // Two columns, the right one dropped half a card, so the wall reads as
  // sheets pinned up over time rather than a grid that was laid out at once.
  const left = TOOLS.filter((_, i) => i % 2 === 0);
  const right = TOOLS.filter((_, i) => i % 2 === 1);

  return (
    <>
      <JsonLd data={collectionLd} />

      <div className="nb-wrap py-[clamp(2.4rem,5.5vw,4rem)]">
        <div className="grid gap-x-[clamp(1.5rem,4vw,3rem)] gap-y-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div>
            <p className="nb-marker">tools / six calculators</p>
            <h1 className="max-w-[16ch]">
              The numbers, <span className="nb-mark">worked out</span>.
            </h1>
            <p className="nb-lede mt-5">
              Six calculators for the questions that stop a build night. Every
              default comes from an official FIRST page or a vendor spec sheet,
              and the source is printed next to the number.
            </p>
          </div>
          <p className="nb-pen max-w-[20ch] rotate-[1.4deg] lg:pb-2 lg:text-right">
            nothing here needs an account
          </p>
        </div>
      </div>

      <section className="nb-rule py-[clamp(2.4rem,5.5vw,4rem)]">
        <div className="nb-wrap">
          <div className="grid gap-[clamp(1.1rem,2.4vw,1.9rem)] lg:grid-cols-2">
            <div className="flex flex-col gap-[clamp(1.1rem,2.4vw,1.9rem)]">
              {left.map((t) => (
                <ToolCard key={t.href} t={t} />
              ))}
            </div>
            <div className="flex flex-col gap-[clamp(1.1rem,2.4vw,1.9rem)] lg:mt-[3.5rem]">
              {right.map((t) => (
                <ToolCard key={t.href} t={t} />
              ))}
            </div>
          </div>

          <p className="nb-note mt-[clamp(1.8rem,4vw,2.8rem)] max-w-[64ch] text-[0.95rem] leading-relaxed text-graphite">
            <span className="nb-slug mb-1 block">before you trust a number</span>
            Figures track the 2025-26 season and current vendor pricing. FIRST
            revises fees and wiring rules most years, so check the current Game
            Manual before an event. None of these tools is a substitute for
            inspection.
          </p>
        </div>
      </section>
    </>
  );
}
