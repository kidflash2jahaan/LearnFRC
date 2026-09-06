export type OnboardingStep = {
  /** Zero-padded step number. Decorative: the <ol> carries the real order. */
  n: string;
  title: string;
  body: string;
  /** The mono line under the hairline, stating what this step costs you. */
  out: string;
};

/**
 * How a team ends up on here, drawn as one frame split three ways.
 *
 * The old file was a client component that grew a gradient spine down three
 * floating cards on scroll. The point of these three steps is that there is no
 * setup, so the honest shape is not three separate objects: it is one strip of
 * paper divided by two ink rules, which is what `nb-panel` is for. The panels
 * are unequal on purpose, because the first step is the only one the reader
 * actually has to do.
 *
 * Server Component. Nothing here needs state, so nothing here ships JavaScript.
 */
export function OnboardingStrip({ steps }: { steps: OnboardingStep[] }) {
  return (
    <ol className="nb-box grid overflow-hidden min-[860px]:grid-cols-[1.15fr_1fr_0.95fr]">
      {steps.map((step) => (
        <li key={step.n} className="nb-panel">
          <span
            className="nb-box-sm grid size-11 flex-none place-items-center rotate-[-2deg] border-blue font-mono text-[1.05rem] font-bold text-blue"
            aria-hidden="true"
          >
            {step.n}
          </span>

          <h3 className="mt-[clamp(0.9rem,2vw,1.1rem)] text-[clamp(1.2rem,1rem+0.75vw,1.6rem)]">
            {step.title}
          </h3>
          <p className="mb-4 mt-2.5 text-[0.96rem] leading-[1.5] text-graphite">
            {step.body}
          </p>

          <p className="nb-slug nb-hair mt-auto pt-4 text-ink">{step.out}</p>
        </li>
      ))}
    </ol>
  );
}
