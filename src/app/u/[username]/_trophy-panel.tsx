import { Avatar } from "@/components/ui/avatar";

/**
 * The stamp in the corner of the record sheet: who, what rank, how far into it.
 *
 * WHAT IT WAS: a glass instrument holding a 176px SVG ring that spring-drew on
 * load in a per-tier hue, with a pulsing "Live" dot above it and a
 * gradient-filled XP rail below. Every part of that is a thing this system does
 * not have. There are five rank tiers and the palette has one accent, so a
 * per-tier colour would have needed four new hues to say what the tier's NAME
 * already says. A ring around an avatar is a second perfect circle, and the one
 * circle in the system is spent on the avatar itself. And a "Live" indicator on
 * a page that changes when its owner finishes a lesson is decoration wearing a
 * status label.
 *
 * So the rank is stamped: the tier in mono caps under a rule, the level as an
 * oversized figure, and the distance to the next one written out. It reads at a
 * glance, it survives a screenshot, and it survives a photocopy.
 *
 * Server Component.
 */
export function RankStamp({
  level,
  levelFraction,
  xpToNext,
  tierName,
  avatarName,
  avatarSrc,
  avatarSeed,
}: {
  level: number;
  /** 0-1 through the current level. */
  levelFraction: number;
  xpToNext: number;
  /** Rookie / Contender / Veteran / All-Star / Champion. */
  tierName: string;
  avatarName: string;
  avatarSrc: string | null;
  avatarSeed: string;
}) {
  const pct = Math.round(Math.min(1, Math.max(0, levelFraction)) * 100);

  return (
    <div className="nb-box-sm nb-tilt-4 w-full max-w-[19rem] p-[clamp(1rem,2.2vw,1.4rem)]">
      <div className="flex items-center gap-3.5">
        <Avatar
          name={avatarName}
          src={avatarSrc}
          seed={avatarSeed}
          className="h-14 w-14 text-[1.05rem]"
        />
        <div className="min-w-0">
          <p className="nb-slug">rank</p>
          <p className="mt-1 font-mono text-[0.95rem] font-bold uppercase leading-none tracking-[0.06em] text-ink">
            {tierName}
          </p>
        </div>
      </div>

      <div className="nb-hair mt-4 flex items-end gap-3 pt-4">
        <p className="font-mono text-[clamp(2.6rem,2rem+2vw,3.4rem)] font-bold leading-[0.85] tabular-nums text-blue">
          {level}
        </p>
        <p className="nb-slug pb-1">level</p>
      </div>

      <span className="nb-meter mt-3 block">
        <span className="nb-meter-bar" style={{ width: `${pct}%` }} />
      </span>

      {/* The figure is printed next to the trough. A bar alone is one colour
          against one colour, which tells a reader who cannot judge that ratio
          by eye nothing at all. */}
      <p className="nb-slug mt-2">
        {pct}% / {xpToNext} xp to level {level + 1}
      </p>
    </div>
  );
}
