"use client";

import type { CSSProperties } from "react";
import Link from "next/link";
import { ArrowRight, Cloud, Trophy, Zap } from "lucide-react";
import { Reveal } from "@/components/motion/primitives";
import { useMyProgress } from "@/components/progress/my-progress";

const GRADIENT_TEXT: CSSProperties = {
  background: "linear-gradient(120deg,#2560e6,#1aa9d6)",
  WebkitBackgroundClip: "text",
  backgroundClip: "text",
  color: "transparent",
};

const PERKS = [
  { icon: Cloud, label: "Saved across every device" },
  { icon: Zap, label: "XP + daily streaks" },
  { icon: Trophy, label: "Certificate on finish" },
] as const;

/**
 * The primary logged-out conversion surface on a lesson page. Rendered inside
 * <MyProgressProvider>; it SSRs its card (the store's initial `authed` is false,
 * so the ask is present in the static HTML a crawler / logged-out visitor sees)
 * and unmounts itself once /api/me/progress confirms the reader is signed in —
 * exactly like the existing <SignupPrompt> in the hero. Placement near the end
 * of the lesson keeps the brief pre-hydration state off-screen for signed-in
 * readers, so it never sticks.
 *
 * Department name, lesson count, and this lesson's 1-based position are computed
 * server-side and passed as props so the copy is contextual with zero fetching.
 */
export function LessonSignupHook({
  department,
  count,
  position,
  lessonPath,
}: {
  department: string;
  count: number;
  position: number;
  lessonPath: string;
}) {
  const { authed } = useMyProgress();
  if (authed) return null;

  const encoded = encodeURIComponent(lessonPath);

  return (
    <Reveal>
      <aside
        aria-label="Create a free account"
        className="ac-glass relative mt-10 overflow-hidden rounded-3xl p-6 sm:p-8"
        style={{ "--a": "#2560e6" } as CSSProperties}
      >
        <span
          aria-hidden
          className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(26,169,214,0.22),transparent_70%)] blur-2xl"
        />
        <div className="relative">
          <p className="ac-eyebrow">Save your progress</p>
          <h2 className="mt-2 text-balance font-display text-2xl font-bold leading-tight tracking-tight sm:text-[1.7rem]">
            You&apos;re on lesson {position} of {count} in{" "}
            <span style={GRADIENT_TEXT}>{department}</span>.
          </h2>
          <p className="mt-3 max-w-xl text-pretty text-[15px] leading-relaxed text-foreground/70">
            Create a free account to keep your place across every device, earn XP
            and streaks, and get a certificate when you finish the track — it
            takes about 10 seconds. You can keep learning either way.
          </p>

          <ul className="mt-5 flex flex-wrap gap-2.5">
            {PERKS.map(({ icon: Icon, label }) => (
              <li
                key={label}
                className="ac-chip inline-flex items-center gap-1.5 text-xs font-medium text-foreground/80"
              >
                <Icon className="h-3.5 w-3.5 text-primary" aria-hidden />
                {label}
              </li>
            ))}
          </ul>

          <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3">
            <Link
              href={`/signup?next=${encoded}&ref=lesson-hook`}
              className="ac-btn text-sm"
            >
              Create a free account
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
            <span className="text-sm text-muted-foreground">
              Already have one?{" "}
              <Link
                href={`/login?next=${encoded}`}
                className="font-semibold text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                Log in
              </Link>
            </span>
          </div>
        </div>
      </aside>
    </Reveal>
  );
}
