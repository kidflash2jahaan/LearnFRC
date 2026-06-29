"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown } from "lucide-react";

const FAQS = [
  {
    q: "Is LearnFRC free?",
    a: "Yes — completely free. Create an account to track your progress, earn XP and achievements, and pick up where you left off. You can browse every guide without signing in.",
  },
  {
    q: "Do I need any experience to start?",
    a: "No. The Getting Started track assumes zero robotics, coding, or engineering background. Each department goes from fundamentals to advanced, so you can start anywhere that fits your role.",
  },
  {
    q: "Where does the content come from?",
    a: "Every guide is researched and fact-checked against authoritative FRC sources — the official WPILib docs, FIRST Inspires, vendor documentation (REV, CTRE, Limelight), Chief Delphi, and The Blue Alliance. Lessons cite their sources so you can dig deeper.",
  },
  {
    q: "Which departments are covered?",
    a: "All of them — mechanical, CAD, programming, electrical, controls & sensors, pneumatics, plus business, media & outreach, the Impact Award, scouting, drive team, safety, and fundraising. Every role on a team has a path.",
  },
  {
    q: "Is this affiliated with FIRST?",
    a: "No. LearnFRC is an independent, student-built learning resource. It is not affiliated with or endorsed by FIRST®. All trademarks belong to their respective owners.",
  },
];

export function Faq() {
  const [open, setOpen] = React.useState<number | null>(0);
  return (
    <div className="mx-auto max-w-3xl space-y-3">
      {FAQS.map((item, i) => {
        const isOpen = open === i;
        return (
          <div
            key={i}
            className={`overflow-hidden rounded-xl border bg-card/60 backdrop-blur-sm transition-colors duration-300 ${
              isOpen
                ? "border-primary/40 shadow-[var(--glow-primary)]"
                : "border-border hover:border-border/80"
            }`}
          >
            <button
              onClick={() => setOpen(isOpen ? null : i)}
              className="flex w-full items-center gap-4 px-5 py-4 text-left cursor-pointer"
              aria-expanded={isOpen}
            >
              <span
                className={`font-mono text-xs transition-colors ${
                  isOpen ? "text-primary" : "text-accent"
                }`}
                aria-hidden
              >
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="flex-1 font-medium">{item.q}</span>
              <ChevronDown
                className={`h-5 w-5 shrink-0 transition-transform duration-300 ${
                  isOpen ? "rotate-180 text-primary" : "text-muted-foreground"
                }`}
              />
            </button>
            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3, ease: [0.21, 0.47, 0.32, 0.98] }}
                  className="overflow-hidden"
                >
                  <p className="border-t border-border/60 px-5 pb-5 pt-4 pl-12 text-sm leading-relaxed text-muted-foreground">
                    {item.a}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}
