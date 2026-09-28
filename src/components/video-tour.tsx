"use client";

import * as React from "react";
import Image from "next/image";
import poster from "./video-tour-poster.jpg";
import { TOUR_VIDEO_ID } from "@/lib/tour-video";

/**
 * The homepage tour video, as a poster until someone asks for it.
 *
 * Nothing from YouTube loads until the play button is pressed: the poster is
 * our own image, served through next/image, so the homepage stays as fast as
 * it was and sets no YouTube cookies for the visitors who never press play.
 * Pressing play swaps in the youtube-nocookie player with autoplay on, so one
 * press is all it takes, and focus moves into the player so keyboard users
 * land on its controls instead of on a button that no longer exists.
 */
export function VideoTour() {
  const [playing, setPlaying] = React.useState(false);
  const frame = React.useRef<HTMLIFrameElement>(null);

  React.useEffect(() => {
    if (playing) frame.current?.focus();
  }, [playing]);

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-[10px] border-2 border-ink bg-ink">
      {playing ? (
        <iframe
          ref={frame}
          src={`https://www.youtube-nocookie.com/embed/${TOUR_VIDEO_ID}?autoplay=1&rel=0`}
          title="LearnFRC: from week 1 to kickoff, a 60-second tour"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          referrerPolicy="strict-origin-when-cross-origin"
          allowFullScreen
          className="absolute inset-0 h-full w-full"
        />
      ) : (
        <button
          type="button"
          onClick={() => setPlaying(true)}
          aria-label="Play the 60-second LearnFRC tour video"
          className="group absolute inset-0 block h-full w-full cursor-pointer"
        >
          <Image
            src={poster}
            alt=""
            fill
            sizes="(min-width: 1024px) 56vw, 100vw"
            className="object-cover"
          />
          {/* The poster keeps its bottom-right corner empty for exactly this. */}
          <span
            aria-hidden="true"
            className="nb-btn absolute bottom-[6%] right-[4%] group-hover:-translate-x-px group-hover:-translate-y-px"
          >
            play / 1:00
          </span>
        </button>
      )}
    </div>
  );
}
