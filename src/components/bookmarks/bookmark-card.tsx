"use client";

import * as React from "react";
import type { CSSProperties } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowUpRight, Bookmark, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { toggleBookmark } from "@/app/actions/progress";
import { Icon } from "@/lib/icon-map";
import { deptMeta, inkFor } from "@/lib/departments";
import { cn } from "@/lib/utils";

export type BookmarkCardData = {
  lessonId: string;
  lessonSlug: string;
  title: string;
  summary: string | null;
  estimatedMinutes: number | null;
  moduleSlug: string;
  deptSlug: string;
  deptName: string;
  savedAt: string;
};

function savedAgo(iso: string) {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "Saved";
  const diff = Date.now() - then;
  const day = 86_400_000;
  if (diff < day) return "Saved today";
  if (diff < 2 * day) return "Saved yesterday";
  const days = Math.floor(diff / day);
  if (days < 7) return `Saved ${days} days ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `Saved ${weeks}w ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `Saved ${months}mo ago`;
  return `Saved ${Math.floor(days / 365)}y ago`;
}

export function BookmarkCard({ data }: { data: BookmarkCardData }) {
  const router = useRouter();
  const reduce = useReducedMotion();
  const [removed, setRemoved] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const m = deptMeta(data.deptSlug);
  const ink = inkFor(m.color);
  const href = `/guides/${data.deptSlug}/${data.moduleSlug}/${data.lessonSlug}`;

  async function handleRemove(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (pending) return;
    setPending(true);
    setRemoved(true); // optimistic
    const res = await toggleBookmark(data.lessonId, false);
    if (res?.error) {
      setRemoved(false);
      setPending(false);
      toast.error("Couldn't remove bookmark", { description: res.error });
      return;
    }
    toast.success("Bookmark removed", {
      description: data.title,
      action: {
        label: "Undo",
        onClick: async () => {
          const undo = await toggleBookmark(data.lessonId, true);
          if (undo?.error) {
            toast.error("Couldn't restore bookmark");
            return;
          }
          router.refresh();
        },
      },
    });
    router.refresh();
  }

  return (
    <AnimatePresence initial={false}>
      {!removed && (
        <motion.div
          layout={!reduce}
          exit={
            reduce
              ? { opacity: 0 }
              : { opacity: 0, x: -24, height: 0, marginBottom: 0 }
          }
          transition={{ type: "spring", stiffness: 380, damping: 34 }}
        >
          <motion.div
            className="group relative"
            whileHover={reduce ? undefined : { y: -3, scale: 1.008 }}
            transition={{ type: "spring", stiffness: 300, damping: 24 }}
          >
            <div className="ac-card relative flex items-stretch gap-4 overflow-hidden p-4 transition-shadow duration-300 sm:p-5">
              {/* Stretched overlay link — keeps the whole card clickable
                  without nesting the remove button inside the anchor. */}
              <Link
                href={href}
                aria-label={`Open lesson: ${data.title}`}
                className="absolute inset-0 z-0 rounded-[20px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                <span className="sr-only">Open lesson: {data.title}</span>
              </Link>

              {/* accent glow */}
              <div
                aria-hidden
                className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full opacity-10 blur-2xl transition-opacity duration-300 group-hover:opacity-25"
                style={{ background: m.color }}
              />
              {/* left accent rail */}
              <div
                aria-hidden
                className="absolute inset-y-0 left-0 w-1 origin-top scale-y-0 transition-transform duration-300 group-hover:scale-y-100"
                style={{ background: `linear-gradient(180deg, ${m.color}, ${m.to})` }}
              />

              <span
                aria-hidden
                className="ac-badge pointer-events-none relative z-[1] hidden h-12 w-12 shrink-0 items-center justify-center sm:flex"
                style={{ "--a": m.color } as CSSProperties}
              >
                <Icon name={m.icon} className="h-6 w-6" />
              </span>

              <div className="pointer-events-none relative z-[1] min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                  <span
                    className="inline-flex items-center gap-1 font-medium"
                    style={{ color: ink }}
                  >
                    <Icon name={m.icon} className="h-3.5 w-3.5 sm:hidden" />
                    {data.deptName}
                  </span>
                  <span aria-hidden>·</span>
                  <span className="inline-flex items-center gap-1">
                    <Bookmark className="h-3 w-3" aria-hidden />
                    <time dateTime={data.savedAt}>{savedAgo(data.savedAt)}</time>
                  </span>
                  {typeof data.estimatedMinutes === "number" && data.estimatedMinutes > 0 && (
                    <>
                      <span aria-hidden>·</span>
                      <span>{data.estimatedMinutes} min read</span>
                    </>
                  )}
                </div>

                <h3 className="mt-1 truncate font-display text-base font-semibold tracking-tight text-foreground transition-colors group-hover:text-primary">
                  {data.title}
                </h3>
                {data.summary && (
                  <p className="mt-1 line-clamp-2 text-[15px] leading-relaxed text-muted-foreground sm:text-sm">
                    {data.summary}
                  </p>
                )}

                <div className="mt-2.5 flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1 font-medium text-foreground/80 transition-colors group-hover:text-primary">
                    Open lesson
                    <ArrowUpRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleRemove}
                disabled={pending}
                aria-label={`Remove bookmark for ${data.title}`}
                className={cn(
                  "relative z-10 grid h-11 w-11 shrink-0 cursor-pointer place-items-center self-start rounded-lg border border-border bg-background/60 text-muted-foreground transition-colors duration-200",
                  "hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive disabled:opacity-60"
                )}
              >
                {pending ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <Trash2 className="h-4 w-4" aria-hidden />
                )}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
