import { Repeat, Flame, Mail } from "lucide-react";
import type { RetentionStats } from "@/lib/retention";

export function RetentionPanel({ s }: { s: RetentionStats }) {
  return (
    <section className="ac-card rounded-2xl p-4">
      <h2 className="mb-2.5 flex items-center gap-2 text-sm font-semibold">
        <Repeat className="h-4 w-4 text-primary" aria-hidden />
        Retention
      </h2>

      {/* Return rate + Activation live in the KPI strip — this panel only
          shows retention metrics that appear nowhere else on the page. */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { icon: Flame, label: "Power users", value: s.powerUsers, sub: "active on 5+ days" },
          { icon: Repeat, label: "Median lessons", value: s.medianLessons, sub: "per activated user" },
          { icon: Mail, label: "Email queue", value: s.lifecycleEligible, sub: `${s.emailedRecently} sent (7d) · ${s.optedOut} opted out` },
        ].map((m) => (
          <div key={m.label} className="rounded-xl border border-border bg-white/60 p-2.5">
            <div className="font-display text-xl font-extrabold leading-none tabular-nums">
              {m.value}
            </div>
            <div className="mt-1 flex items-center gap-1 text-[11px] font-medium text-foreground">
              <m.icon className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden />
              {m.label}
            </div>
            <div className="text-[11px] leading-tight text-muted-foreground tabular-nums">
              {m.sub}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
