"use client";

import * as React from "react";
import Image, { type StaticImageData } from "next/image";

/**
 * A YouTube video as a poster until someone asks for it.
 *
 * Nothing from YouTube loads until the play button is pressed, so the page
 * stays as fast as it was and sets no YouTube cookies for readers who never
 * press play. Pressing play swaps in the youtube-nocookie player with autoplay
 * on, so one press is all it takes, and focus moves into the player so a
 * keyboard user lands on its controls instead of on a button that is gone.
 */
export function YouTubeFacade({
  videoId,
  title,
  poster,
  sizes,
  label,
  playLabel,
}: {
  videoId: string;
  /** The iframe's accessible title once it's playing. */
  title: string;
  /** Our own image, or YouTube's thumbnail when there's no custom poster. */
  poster?: StaticImageData | string;
  sizes: string;
  /** What the play button says. */
  label: string;
  /** The button's accessible name. */
  playLabel: string;
}) {
  const [playing, setPlaying] = React.useState(false);
  const frame = React.useRef<HTMLIFrameElement>(null);

  React.useEffect(() => {
    if (playing) frame.current?.focus();
  }, [playing]);

  const src = poster ?? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-[10px] border-2 border-ink bg-ink">
      {playing ? (
        <iframe
          ref={frame}
          src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0`}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          referrerPolicy="strict-origin-when-cross-origin"
          allowFullScreen
          className="absolute inset-0 h-full w-full"
        />
      ) : (
        <button
          type="button"
          onClick={() => setPlaying(true)}
          aria-label={playLabel}
          className="group absolute inset-0 block h-full w-full cursor-pointer"
        >
          <Image src={src} alt="" fill sizes={sizes} className="object-cover" />
          <span
            aria-hidden="true"
            className="nb-btn absolute bottom-[6%] right-[4%] group-hover:-translate-x-px group-hover:-translate-y-px"
          >
            {label}
          </span>
        </button>
      )}
    </div>
  );
}
