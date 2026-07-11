import type { CSSProperties } from "react";
import { Repeat, Flame, Zap, Mail } from "lucide-react";
import type { RetentionStats } from "@/lib/retention";

const GRADIENT: CSSProperties = {
  background: "linear-gradient(120deg,#2560e6,#1aa9d6)",
  WebkitBackgroundClip: "text",
  backgroundClip: "text",
  color: "transparent",
};

/** The one number the 2-year plan hinges on: do users come back? */
function toneForReturn(pct: number): { label: string; cls: string } {
  if (pct >= 50) return { label: "on target", cls: "text-emerald-600" };
  if (pct >= 40) return { label: "close", cls: "text-amber-600" };
  return { label: "below target (aim 50%+)", cls: "text-red-600" };
}

export function RetentionPanel({ s }: { s: RetentionStats }) {
  const rt = toneForReturn(s.returnPct);
  return (
    <section className="ac-card rounded-2xl p-6">
      <div className="mb-5 flex items-center gap-2">
        <Repeat className="h-4 w-4 text-primary" aria-hidden />
        <h2 className="font-display text-lg font-bold tracking-tight">
          Retention
        </h2>
        <span className="ml-auto text-xs text-muted-foreground">
          the metric the whole growth plan sits on
        </span>
      </div>

      {/* Headline: return rate */}
      <div className="rounded-2xl border border-border bg-secondary/40 p-5">
        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Return rate · came back on a 2nd day
        </div>
        <div className="mt-1 flex items-baseline gap-3">
          <span className="font-display text-4xl font-extrabold tabular-nums" style={GRADIENT}>
            {s.returnPct}%
          </span>
          <span className={`text-sm font-semibold ${rt.cls}`}>{rt.label}</span>
        </div>
        <div className="mt-1 text-sm text-muted-foreground tabular-nums">
          {s.returned} of {s.activated} activated learners · target is 50%+ for
          the referral loop to compound.
        </div>
      </div>

      {/* Secondary metrics */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { icon: Zap, label: "Activation", value: `${s.activationPct}%`, sub: `${s.activated}/${s.totalUsers} did ≥1 lesson` },
          { icon: Flame, label: "Power users", value: s.powerUsers, sub: "active on 5+ days" },
          { icon: Repeat, label: "Median lessons", value: s.medianLessons, sub: "per activated user" },
          { icon: Mail, label: "Email queue", value: s.lifecycleEligible, sub: `${s.emailedRecently} sent (7d) · ${s.optedOut} opted out` },
        ].map((m) => (
          <div key={m.label} className="rounded-xl border border-border bg-white/60 p-3">
            <m.icon className="mb-1.5 h-4 w-4 text-primary" aria-hidden />
            <div className="font-display text-xl font-extrabold tabular-nums">
              {m.value}
            </div>
            <div className="text-xs font-medium text-foreground">{m.label}</div>
            <div className="mt-0.5 text-[11px] leading-tight text-muted-foreground tabular-nums">
              {m.sub}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
