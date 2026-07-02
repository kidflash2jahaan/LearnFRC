"use client";

import * as React from "react";
import { useReducedMotion } from "framer-motion";
import { Gauge } from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

const KEY = "perf-mode";

export function setPerfMode(on: boolean) {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.perf = on ? "on" : "off";
  try {
    localStorage.setItem(KEY, on ? "on" : "off");
  } catch {
    /* storage unavailable */
  }
  window.dispatchEvent(new Event("perf-mode-change"));
}

export function usePerfMode(): boolean {
  const [on, setOn] = React.useState(false);
  React.useEffect(() => {
    const read = () => setOn(document.documentElement.dataset.perf === "on");
    read();
    window.addEventListener("perf-mode-change", read);
    window.addEventListener("storage", read);
    return () => {
      window.removeEventListener("perf-mode-change", read);
      window.removeEventListener("storage", read);
    };
  }, []);
  return on;
}

/** Skip animations when Performance mode is on OR the OS prefers reduced motion. */
export function useStaticMotion(): boolean {
  const perf = usePerfMode();
  const reduce = useReducedMotion();
  return perf || !!reduce;
}

export function PerfModeCard() {
  const on = usePerfMode();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  return (
    <Card className="border-border/80">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Gauge className="h-4.5 w-4.5 text-primary" /> Motion & effects
        </CardTitle>
        <CardDescription>
          Animations look great but can lag on older devices or some browsers. Turn
          on Performance mode for a faster, smoother experience.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium">Performance mode</p>
            <p className="text-xs text-muted-foreground">
              Turns off background effects, blurs, and entrance animations.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={mounted ? on : false}
            aria-label="Toggle performance mode"
            onClick={() => setPerfMode(!on)}
            className={cn(
              "relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              on ? "bg-primary" : "bg-muted"
            )}
          >
            <span
              className={cn(
                "inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform",
                on ? "translate-x-[1.375rem]" : "translate-x-0.5"
              )}
            />
          </button>
        </div>
      </CardContent>
    </Card>
  );
}
