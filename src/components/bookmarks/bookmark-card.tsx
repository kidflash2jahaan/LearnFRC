"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { toggleBookmark } from "@/app/actions/progress";

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
  if (Number.isNaN(then)) return "saved";
  const diff = Date.now() - then;
  const day = 86_400_000;
  if (diff < day) return "saved today";
  if (diff < 2 * day) return "saved yesterday";
  const days = Math.floor(diff / day);
  if (days < 7) return `saved ${days} days ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `saved ${weeks}w ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `saved ${months}mo ago`;
  return `saved ${Math.floor(days / 365)}y ago`;
}

/**
 * One saved lesson, as an entry filed in the folder.
 *
 * IT IS A RULED ENTRY, NOT A CARD. A card inside a card is two frames drawn
 * around one thing, and on a page whose whole job is "which of these do I open
 * now" the frames are what you end up reading instead of the titles. So the
 * entries share the folder's edge and are separated by the dashed hairline the
 * rest of the binder uses between list items.
 *
 * WHAT WENT: the department hue, the icon badge, the blurred accent glow, the
 * sliding accent rail, the hover spring and the height-collapsing exit
 * animation. The removal is still optimistic and still undoable, but it happens
 * at once, the way a line gets struck off a list. `router.refresh()` then makes
 * the server the source of truth again.
 *
 * The whole entry is the target: a stretched link covers it, and the remove
 * button sits above that link rather than inside it, so the two controls never
 * nest.
 */
export function BookmarkCard({ data }: { data: BookmarkCardData }) {
  const router = useRouter();
  const [removed, setRemoved] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const href = `/guides/${data.deptSlug}/${data.moduleSlug}/${data.lessonSlug}`;

  async function handleRemove() {
    if (pending) return;
    setPending(true);
    setRemoved(true); // optimistic
    const res = await toggleBookmark(data.lessonId, false);
    if (res?.error) {
      setRemoved(false);
      setPending(false);
      toast.error("Couldn't remove that bookmark", { description: res.error });
      return;
    }
    toast.success("Bookmark removed", {
      description: data.title,
      action: {
        label: "Undo",
        onClick: async () => {
          const undo = await toggleBookmark(data.lessonId, true);
          if (undo?.error) {
            toast.error("Couldn't put it back");
            return;
          }
          router.refresh();
        },
      },
    });
    router.refresh();
  }

  // Struck off. The entry and its rule leave together, so the folder never
  // shows a hairline with nothing under it.
  if (removed) return null;

  return (
    <li className="group relative border-b border-dashed border-rule last:border-b-0">
      <div className="grid items-baseline gap-x-[clamp(1rem,3vw,2.2rem)] gap-y-2 px-[clamp(1rem,2.4vw,1.7rem)] py-[clamp(1rem,2.2vw,1.4rem)] transition-[background-color] duration-100 group-hover:bg-[rgba(27,54,200,0.055)] min-[760px]:grid-cols-[minmax(0,13rem)_minmax(0,1fr)_auto]">
        {/* The filing line: where it came from and when it went in. */}
        <p className="nb-slug min-w-0">
          <span className="block truncate">dept / {data.deptSlug}</span>
          <time dateTime={data.savedAt} className="block">
            {savedAgo(data.savedAt)}
            {typeof data.estimatedMinutes === "number" &&
            data.estimatedMinutes > 0
              ? ` / ${data.estimatedMinutes} min`
              : ""}
          </time>
        </p>

        <div className="min-w-0">
          <h3 className="text-[clamp(1.02rem,0.95rem+0.4vw,1.28rem)] leading-tight">
            {/* The stretched link. It carries the accessible name for the whole
                entry, and the focus ring lands on this element rather than on
                an invisible overlay. */}
            <Link
              href={href}
              className="after:absolute after:inset-0 after:content-[''] group-hover:underline group-hover:decoration-blue group-hover:decoration-2 group-hover:underline-offset-[5px]"
            >
              {data.title}
            </Link>
          </h3>
          {data.summary && (
            <p className="mt-1.5 text-[0.92rem] leading-snug text-graphite">
              {data.summary}
            </p>
          )}
          <p className="nb-slug mt-1.5">{data.deptName}</p>
        </div>

        <button
          type="button"
          onClick={handleRemove}
          disabled={pending}
          className="nb-btn-ghost nb-btn-sm relative z-10 shrink-0 justify-self-start min-[760px]:justify-self-end"
        >
          {pending ? "Removing" : "Remove"}
          <span className="sr-only"> {data.title} from your bookmarks</span>
        </button>
      </div>
    </li>
  );
}
