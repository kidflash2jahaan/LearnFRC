/**
 * THE INSPECTION STAMP.
 *
 * A certificate in a build binder is not a foil medallion, it is a page that
 * somebody stamped and initialled. So the credential mark here is a rubber
 * stamp: a ruled box, struck at an angle, with the ink slightly off register
 * because a hand pressed it. That misregistration is the second border behind
 * the first, and it is the whole reason the thing reads as pressed rather than
 * drawn.
 *
 * WHAT IT IS NOT. It was a rotating ring of micro-type around a gradient
 * medallion, which needed a perfect circle, three colours the palette does not
 * own, a drop shadow and an infinite animation. All four are out of the system.
 * The stamp is two borders, four lines of Space Mono and one tilt.
 *
 * Both marks are Server Components: nothing here has state and nothing moves.
 */

/**
 * The earned mark. Pressed into the top corner of the certificate, the way an
 * inspector stamps a drawing, not centred like a sticker.
 */
export function CertificateStamp({
  deptSlug,
  year,
}: {
  /** The department's mono slug, which always fits on one line. The full name
      is set on the certificate's own rule, where it has the width for it. */
  deptSlug: string;
  year: number;
}) {
  return (
    <span
      className="relative inline-block rotate-[-4.5deg] select-none print:rotate-[-4.5deg]"
      role="img"
      aria-label={`Stamped: LearnFRC certified, ${deptSlug}, ${year}`}
    >
      {/* The off-register second strike. Decoration, and the only thing that
          makes two rectangles look like a stamp instead of a border. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -inset-[3px] rotate-[1.6deg] rounded-[var(--hand-s)] border-2 border-blue/30"
      />
      <span className="nb-box-sm relative block border-blue bg-transparent px-[1.15rem] py-[0.85rem] text-center">
        <span className="nb-slug block text-[0.72rem] font-bold tracking-[0.22em] text-blue">
          LEARNFRC
        </span>
        <span
          aria-hidden="true"
          className="mt-1.5 block h-px w-full bg-blue/45"
        />
        <span className="nb-slug mt-1.5 block text-[1rem] font-bold tracking-[0.14em] text-blue">
          CERTIFIED
        </span>
        <span
          aria-hidden="true"
          className="mt-1.5 block h-px w-full bg-blue/45"
        />
        <span className="nb-slug mt-1.5 block text-[0.68rem] tracking-[0.06em] text-blue">
          {deptSlug}
        </span>
        <span className="nb-slug block text-[0.68rem] tracking-[0.18em] text-blue">
          {year}
        </span>
      </span>
    </span>
  );
}

/**
 * The same box before anybody stamped it: dashed, graphite, and carrying the
 * figure that is missing rather than the one that is earned. Pairing the two
 * shapes is what makes the locked page legible in a glance, and it survives a
 * greyscale photocopy because the difference is the stroke, not the colour.
 */
export function UnstampedBox({
  pct,
  done,
  total,
}: {
  pct: number;
  done: number;
  total: number;
}) {
  return (
    <span
      className="relative inline-block rotate-[-2.4deg] select-none"
      role="img"
      aria-label={`Not signed off yet, ${done} of ${total} lessons finished`}
    >
      <span className="relative block rounded-[var(--hand-s)] border-2 border-dashed border-graphite bg-transparent px-[1.15rem] py-[0.9rem] text-center">
        <span className="nb-slug block text-[0.72rem] font-bold tracking-[0.22em]">
          LEARNFRC
        </span>
        <span
          aria-hidden="true"
          className="mt-1.5 block h-px w-full bg-[var(--rule)]"
        />
        <span className="nb-count mt-2 block text-[1.9rem] text-ink">
          {pct}
          <span className="text-[1rem]">%</span>
        </span>
        <span className="nb-slug mt-1 block text-[0.68rem] tracking-[0.12em]">
          not signed off
        </span>
      </span>
    </span>
  );
}
