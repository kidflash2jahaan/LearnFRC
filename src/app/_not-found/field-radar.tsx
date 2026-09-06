/**
 * The card that says what the binder does and does not have.
 *
 * This file keeps its old path so nothing else in `app/` has to move; what was
 * here was a "field radar", a glass dial with a conic sweep rotating forever
 * and a red blip pinging on a two-second loop, under a heading that claimed
 * telemetry the site does not have. A 404 is not a lost robot. It is a sheet
 * that is not in the binder, so this is the tab card you find in its place:
 * taped down, stamped with the code, and honest about what it knows.
 *
 * Server Component. Nothing moves.
 */
export function MissingSheet() {
  return (
    <div className="nb-box nb-tilt-2 w-full p-[clamp(1.2rem,2.4vw,1.7rem)]">
      <span className="nb-tape -top-3 left-[18%] rotate-[-4.2deg]" aria-hidden="true" />

      <p className="nb-slug border-b border-dashed border-rule pb-3">
        response / http status
      </p>

      <p className="mt-4 font-mono text-[clamp(3rem,2rem+4vw,4.6rem)] font-bold leading-none tracking-[-0.04em] tabular-nums text-blue">
        404
      </p>

      <dl className="mt-5 border-t border-dashed border-rule pt-4">
        <div className="flex items-baseline justify-between gap-3 py-1.5">
          <dt className="nb-slug">what you asked for</dt>
          <dd className="nb-slug font-bold text-ink">not filed</dd>
        </div>
        <div className="flex items-baseline justify-between gap-3 border-t border-[rgba(22,24,27,0.13)] py-1.5">
          <dt className="nb-slug">rest of the binder</dt>
          <dd className="nb-slug font-bold text-ink">still here</dd>
        </div>
        <div className="flex items-baseline justify-between gap-3 border-t border-[rgba(22,24,27,0.13)] py-1.5">
          <dt className="nb-slug">what it costs you</dt>
          <dd className="nb-slug font-bold text-ink">nothing</dd>
        </div>
      </dl>

      <p className="mt-4 border-t border-dashed border-rule pt-4 text-[0.92rem] leading-snug text-graphite">
        Every other page is where it was. Pick one of the routes below, or search
        the whole catalogue.
      </p>
    </div>
  );
}
