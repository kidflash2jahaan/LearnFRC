"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { FAQS } from "@/lib/faq-data";

export function Faq() {
  const [open, setOpen] = React.useState<number | null>(0);
  return (
    <div className="mx-auto max-w-3xl space-y-3">
      {FAQS.map((item, i) => {
        const isOpen = open === i;
        return (
          <div
            key={i}
            className={`aq-card overflow-hidden transition-colors duration-300 ${
              isOpen ? "border-primary/40" : "aq-card-hover"
            }`}
          >
            <button
              onClick={() => setOpen(isOpen ? null : i)}
              className="flex w-full items-center gap-4 px-5 py-4 text-left cursor-pointer"
              aria-expanded={isOpen}
            >
              <span
                className={`font-mono text-xs tabular-nums transition-colors ${
                  isOpen ? "text-primary" : "text-accent"
                }`}
                aria-hidden
              >
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="flex-1 font-medium text-foreground">{item.q}</span>
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
                  <p className="border-t border-border/60 px-5 pb-5 pt-4 pl-12 text-base leading-relaxed text-muted-foreground">
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
