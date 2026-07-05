import type { CSSProperties } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import {
  PencilLine,
  FilePlus2,
  GitPullRequestArrow,
  Check,
  X,
  Clock,
  ArrowRight,
} from "lucide-react";
import { Reveal, Glow } from "@/components/motion/primitives";
import { getPublicContributions, type PublicContribution } from "@/lib/queries";

export const metadata: Metadata = {
  title: "Community contributions · LearnFRC",
  description:
    "See what the LearnFRC community is improving in the open — pending edit suggestions and new-lesson proposals, plus what's recently been merged. Anyone with an account can suggest a change.",
  alternates: { canonical: "/contributions" },
};

// The queue changes as people submit and as edits are reviewed; keep it fresh
// without hitting the DB on every request.
export const revalidate = 60;

const HEADLINE_GRADIENT: CSSProperties = {
  background: "linear-gradient(120deg,#2560e6,#1aa9d6)",
  WebkitBackgroundClip: "text",
  backgroundClip: "text",
  color: "transparent",
};

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const s = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  const mo = Math.floor(d / 30);
  return `${mo}mo ago`;
}

function StatusBadge({ status }: { status: PublicContribution["status"] }) {
  if (status === "merged")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-success/12 px-2 py-0.5 text-xs font-semibold text-success">
        <Check className="h-3 w-3" aria-hidden /> Merged
      </span>
    );
  if (status === "declined")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
        <X className="h-3 w-3" aria-hidden /> Declined
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-primary/12 px-2 py-0.5 text-xs font-semibold text-primary">
      <Clock className="h-3 w-3" aria-hidden /> Open
    </span>
  );
}

function Row({ c }: { c: PublicContribution }) {
  const Icon = c.kind === "edit" ? PencilLine : FilePlus2;
  const kindLabel = c.kind === "edit" ? "Edit suggestion" : "New lesson";
  return (
    <li className="ac-card p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Icon className="h-4 w-4 shrink-0 text-primary" aria-hidden />
            {c.targetPath ? (
              <Link
                href={c.targetPath}
                className="truncate font-display font-semibold text-foreground hover:text-primary"
              >
                {c.targetTitle}
              </Link>
            ) : (
              <span className="truncate font-display font-semibold text-foreground">
                {c.targetTitle}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {kindLabel} ·{" "}
            {c.byUsername ? (
              <Link href={`/u/${c.byUsername}`} className="font-medium text-foreground hover:text-primary">
                @{c.byUsername}
              </Link>
            ) : (
              <span className="font-medium text-foreground">a member</span>
            )}{" "}
            · {timeAgo(c.date)}
          </p>
        </div>
        <StatusBadge status={c.status} />
      </div>
      {c.note && (
        <p className="mt-3 rounded-lg bg-secondary/50 px-3 py-2 text-sm text-foreground/90">
          “{c.note.slice(0, 400)}”
        </p>
      )}
    </li>
  );
}

export default async function ContributionsPage() {
  const { open, resolved } = await getPublicContributions();

  return (
    <div className="relative overflow-x-clip">
      <Glow
        blobs={[
          { size: "600px", pos: { left: "-160px", top: "-180px" }, color: "#8bbcff", opacity: 0.55 },
          { size: "520px", pos: { right: "-140px", top: "-80px" }, color: "#9bd0ff", opacity: 0.45, delay: 2 },
        ]}
      />

      <section className="mx-auto max-w-4xl px-4 pb-8 pt-28 sm:px-6 lg:px-8 lg:pt-32">
        <Reveal>
          <span className="ac-chip inline-flex items-center gap-2">
            <GitPullRequestArrow className="h-3.5 w-3.5 text-primary" aria-hidden />
            <span className="ac-eyebrow">In the open</span>
          </span>
          <h1 className="mt-5 text-balance font-display text-4xl font-extrabold leading-[1.05] sm:text-5xl">
            Community <span style={HEADLINE_GRADIENT}>contributions</span>
          </h1>
          <p className="mt-4 max-w-2xl text-pretty text-lg leading-relaxed text-foreground/70">
            Every lesson and article on LearnFRC can be improved by the community.
            Anyone with an account can suggest an edit or propose a new lesson —
            here’s everything that’s open right now, and what’s recently been
            merged. Nothing is a black box.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Link href="/guides" className="ac-btn text-sm">
              Find something to improve <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
            <span className="text-sm text-muted-foreground">
              Open the lesson or article, then hit “Suggest an edit.”
            </span>
          </div>
        </Reveal>
      </section>

      <section className="mx-auto max-w-4xl px-4 pb-24 sm:px-6 lg:px-8">
        {/* Open */}
        <Reveal>
          <div className="mt-6 flex items-baseline justify-between">
            <h2 className="font-display text-xl font-bold text-foreground">
              Open suggestions
            </h2>
            <span className="text-sm text-muted-foreground">
              {open.length} open
            </span>
          </div>
          {open.length ? (
            <ul className="mt-4 space-y-3">
              {open.map((c) => (
                <Row key={`${c.kind}-${c.id}`} c={c} />
              ))}
            </ul>
          ) : (
            <div className="ac-card mt-4 p-6 text-center">
              <p className="text-sm text-muted-foreground">
                Nothing open right now. Spot something to fix?{" "}
                <Link href="/guides" className="font-medium text-primary hover:underline">
                  Open a lesson and suggest an edit.
                </Link>
              </p>
            </div>
          )}
        </Reveal>

        {/* Recently resolved */}
        {resolved.length > 0 && (
          <Reveal>
            <div className="mt-12 flex items-baseline justify-between">
              <h2 className="font-display text-xl font-bold text-foreground">
                Recently resolved
              </h2>
            </div>
            <ul className="mt-4 space-y-3">
              {resolved.map((c) => (
                <Row key={`${c.kind}-${c.id}`} c={c} />
              ))}
            </ul>
          </Reveal>
        )}
      </section>
    </div>
  );
}
