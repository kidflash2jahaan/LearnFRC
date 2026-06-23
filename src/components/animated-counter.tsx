"use client";

import * as React from "react";
import { useInView, useMotionValue, useSpring } from "framer-motion";
import { useStaticMotion } from "@/components/perf-mode";

export function AnimatedCounter({
  value,
  suffix = "",
  className,
}: {
  value: number;
  suffix?: string;
  className?: string;
}) {
  const ref = React.useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const reduce = useStaticMotion();
  const mv = useMotionValue(0);
  const spring = useSpring(mv, { stiffness: 60, damping: 18 });
  const [display, setDisplay] = React.useState(0);

  React.useEffect(() => {
    if (inView) mv.set(value);
  }, [inView, value, mv]);

  React.useEffect(() => {
    if (reduce) {
      setDisplay(value);
      return;
    }
    return spring.on("change", (v) => setDisplay(Math.round(v)));
  }, [spring, reduce, value]);

  return (
    <span ref={ref} className={className}>
      {(reduce ? value : display).toLocaleString()}
      {suffix}
    </span>
  );
}
