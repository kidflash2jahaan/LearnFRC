import type { CSSProperties } from "react";
import { Repeat, Flame, Zap, Mail } from "lucide-react";
import type { RetentionStats } from "@/lib/retention";

const GRADIENT: CSSProperties = {
  background: "linear-gradient(120deg,#2560e6,#1aa9d6)",
  WebkitBackgroundClip: "text",
  backgroundClip: "text",
  color: "transparent",
};

export function RetentionPanel({ s }: { s: RetentionStats }) {
  return (
    <section className="ac-card rounded-2xl p-5 sm:p-6">
      <h2 className="mb-5 flex items-center gap-2 text-lg font-semibold">
        <span
          className="ac-badge flex h-9 w-9 items-center justify-center"
          style={{ "--a": "var(--primary)" } as CSSProperties}
        >
          <Repeat className="h-[18px] w-[18px]" aria-hidden />
        </span>
        Retention
      </h2>

      {/* Return rate */}
      <div className="rounded-2xl border border-border bg-secondary/40 p-5">
        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Return rate · came back on a 2nd day
        </div>
        <div className="mt-1 font-display text-4xl font-extrabold tabular-nums" style={GRADIENT}>
          {s.returnPct}%
        </div>
        <div className="mt-1 text-sm text-muted-foreground tabular-nums">
          {s.returned} of {s.activated} activated learners
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
