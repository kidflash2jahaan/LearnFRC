import type { CSSProperties } from "react";
import Link from "next/link";
import { ArrowRight, BookOpen, CheckCircle2, Flame, Sparkles } from "lucide-react";

const GRADIENT: CSSProperties = {
  background: "linear-gradient(120deg,#2560e6,#1aa9d6)",
  WebkitBackgroundClip: "text",
  backgroundClip: "text",
  color: "transparent",
};

const STEPS = [
  {
    icon: BookOpen,
    title: "Finish one lesson",
    body: "Short and focused — about 5 minutes. That's your first win.",
  },
  {
    icon: CheckCircle2,
    title: "Pass the quiz, earn XP",
    body: "It only counts when you get the answers right. Real progress.",
  },
  {
    icon: Flame,
    title: "Come back tomorrow",
    body: "Do one a day to build a streak (and a bigger XP multiplier).",
  },
];

/**
 * Shown only to brand-new (zero-progress) learners: replaces the paradox of
 * choice (11 departments, 394 lessons) with one clear first action, and sets
 * the daily-return expectation — the two things that lift day-1 retention.
 */
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
      className="ac-glass relative overflow-hidden p-6 sm:p-8"
      style={{ "--a": "#2560e6" } as CSSProperties}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-[radial-gradient(circle,rgba(26,169,214,0.22),transparent_70%)] blur-2xl"
      />
      <span className="ac-chip inline-flex items-center gap-2">
        <Sparkles className="h-3.5 w-3.5 text-primary" aria-hidden />
        <span className="ac-eyebrow">New here? Start in 5 minutes</span>
      </span>

      <h2 className="mt-4 text-balance font-display text-2xl font-bold tracking-tight sm:text-3xl">
        Welcome to <span style={GRADIENT}>LearnFRC</span> 🤖
      </h2>
      <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-foreground/70">
        The fastest way in is to finish one lesson. Here&apos;s the whole loop —
        it takes about five minutes.
      </p>

      <ol className="mt-6 grid gap-3 sm:grid-cols-3">
        {STEPS.map((s, i) => (
          <li
            key={s.title}
            className="rounded-2xl border border-border bg-white/60 p-4"
          >
            <div className="flex items-center gap-2">
              <span
                className="ac-badge flex h-8 w-8 items-center justify-center rounded-xl text-sm font-bold"
                style={{ "--a": "#2560e6" } as CSSProperties}
              >
                {i + 1}
              </span>
              <s.icon className="h-4 w-4 text-primary" aria-hidden />
            </div>
            <div className="mt-2.5 font-display text-[15px] font-bold tracking-tight">
              {s.title}
            </div>
            <p className="mt-1 text-[13px] leading-snug text-muted-foreground">
              {s.body}
            </p>
          </li>
        ))}
      </ol>

      <div className="mt-6 flex flex-col gap-1.5">
        <Link href={href} className="ac-btn self-start text-sm">
          Start your first lesson: {lessonTitle}
          <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
        <span className="text-xs text-muted-foreground">in {deptName}</span>
      </div>
    </section>
  );
}
