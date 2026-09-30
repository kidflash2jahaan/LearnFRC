"use client";

import poster from "./video-tour-poster.jpg";
import { TOUR_VIDEO_ID } from "@/lib/tour-video";
import { YouTubeFacade } from "./youtube-facade";

/** The homepage tour video: our own poster, the 60-second ad behind it. */
export function VideoTour() {
  return (
    <YouTubeFacade
      videoId={TOUR_VIDEO_ID}
      title="LearnFRC: from week 1 to kickoff, a 60-second tour"
      poster={poster}
      sizes="(min-width: 1024px) 56vw, 100vw"
      label="play / 1:00"
      playLabel="Play the 60-second LearnFRC tour video"
    />
  );
}
