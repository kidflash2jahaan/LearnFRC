import type { CSSProperties } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import {
  Wrench,
  Calculator,
  Cable,
  Move3d,
  BatteryCharging,
  ArrowRight,
} from "lucide-react";
import {
  RiseGroup,
  RiseItem,
  RevealGroup,
  RevealItem,
  Hover,
  Glow,
} from "@/components/motion/primitives";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://learnfrc.com";

const GRADIENT_TEXT: CSSProperties = {
  background: "linear-gradient(120deg,#2560e6,#1aa9d6)",
  WebkitBackgroundClip: "text",
  backgroundClip: "text",
  color: "transparent",
};

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

const TOOLS = [
  {
    href: "/tools/frc-budget-calculator",
    icon: Calculator,
    color: "#2560e6",
    title: "Team Budget Calculator",
    desc: "What will your season actually cost? Itemize registration, drivetrain, electronics, tools, and travel — with a sponsor-ready summary.",
    tag: "Fundraising",
  },
  {
    href: "/tools/frc-wire-gauge-calculator",
    icon: Cable,
    color: "#1aa9d6",
    title: "Wire Gauge & Voltage Drop",
    desc: "Check voltage drop over a run and confirm your gauge meets FRC's minimum-AWG rules for each breaker size. Built from Ohm's law + the manual.",
    tag: "Electrical",
  },
  {
    href: "/tools/frc-tipping-calculator",
    icon: Move3d,
    color: "#7c5cff",
    title: "Tip-Over & Stability",
    desc: "Enter track width, wheelbase, and center-of-gravity height to find how hard you can turn or how steep a ramp you can climb before tipping.",
    tag: "Drivetrain",
  },
  {
    href: "/tools/frc-current-budget",
    icon: BatteryCharging,
    color: "#12a150",
    title: "Current Budget & Brownout",
    desc: "Add up your mechanisms' current draw against the 120 A main breaker and the roboRIO brownout thresholds — before you brown out at an event.",
    tag: "Power",
  },
];

export default function ToolsPage() {
  return (
    <div className="relative overflow-x-clip">
      <Glow
        blobs={[
          { size: "560px", pos: { left: "-160px", top: "-200px" }, color: "#8bbcff", opacity: 0.6 },
          { size: "520px", pos: { right: "-160px", top: "-80px" }, color: "#6ff0ea", opacity: 0.5, delay: 2 },
        ]}
      />

      <section className="mx-auto max-w-6xl px-4 pb-20 pt-28 sm:px-6 lg:px-8 lg:pt-32">
        <RiseGroup>
          <RiseItem>
            <span className="ac-chip inline-flex items-center gap-2">
              <Wrench className="h-3.5 w-3.5 text-primary" aria-hidden />
              <span className="ac-eyebrow">Free FRC tools</span>
            </span>
          </RiseItem>
          <RiseItem>
            <h1 className="mt-5 max-w-3xl text-balance font-display text-3xl font-bold leading-[1.05] tracking-tight sm:text-4xl md:text-5xl">
              Calculators that get the <span style={GRADIENT_TEXT}>numbers right</span>
            </h1>
          </RiseItem>
          <RiseItem>
            <p className="mt-5 max-w-2xl text-lg leading-relaxed text-foreground/70">
              Interactive tools for the questions every FRC team hits — budget,
              wiring, stability, and power. Every default is pulled from an
              official FIRST or vendor source and cited right in the tool. Free,
              no account needed to use.
            </p>
          </RiseItem>
        </RiseGroup>

        <RevealGroup className="mt-10 grid gap-4 sm:grid-cols-2">
          {TOOLS.map((t) => (
            <RevealItem key={t.href}>
              <Hover className="h-full" lift={-5}>
                <Link
                  href={t.href}
                  className="ac-card group flex h-full flex-col gap-3 rounded-2xl p-6 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  style={{ "--a": t.color } as CSSProperties}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="ac-badge flex h-11 w-11 items-center justify-center rounded-2xl"
                      style={{ "--a": t.color } as CSSProperties}
                    >
                      <t.icon className="h-5 w-5" aria-hidden />
                    </span>
                    <span className="ac-eyebrow text-xs">{t.tag}</span>
                  </div>
                  <h2 className="font-display text-xl font-bold tracking-tight transition-colors group-hover:text-primary">
                    {t.title}
                  </h2>
                  <p className="text-[15px] leading-relaxed text-foreground/70">
                    {t.desc}
                  </p>
                  <span className="mt-auto inline-flex items-center gap-1 pt-1 text-sm font-semibold text-primary">
                    Open tool
                    <ArrowRight
                      className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5"
                      aria-hidden
                    />
                  </span>
                </Link>
              </Hover>
            </RevealItem>
          ))}
        </RevealGroup>

        <p className="mt-8 text-sm text-muted-foreground">
          Figures reflect the 2025–26 season and current vendor pricing — always
          verify against the official FIRST Game Manual before an event.
        </p>
      </section>
    </div>
  );
}
