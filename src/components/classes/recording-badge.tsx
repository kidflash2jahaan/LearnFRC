import { RECORDING_BADGE } from "@/lib/classes/notice";

/**
 * The badge that stays on screen for the whole class (section 6.5): a red
 * dot, "Recorded", and who records and reviews it. It sits in the room's own
 * bar, outside the video, so nothing in the meeting can hide it. The UI Kit's
 * own recording indicator also shows while the recorder runs.
 *
 * The one red on the site: a recording light is a signal people already know,
 * so it's the one place the palette gives way. The dot holds still when the
 * reader asks for reduced motion.
 */
export function RecordingBadge() {
  return (
    <p className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-[0.9rem] leading-snug">
      <span aria-hidden="true" className="relative inline-flex size-2.5 shrink-0">
        <span className="absolute inline-flex size-full rounded-full bg-[#D3263A] opacity-60 motion-safe:animate-ping" />
        <span className="relative inline-flex size-2.5 rounded-full bg-[#D3263A]" />
      </span>
      <b className="font-bold">{RECORDING_BADGE.label}</b>
      <span className="text-graphite">{RECORDING_BADGE.detail}</span>
    </p>
  );
}
