import { Avatar } from "@/components/ui/avatar";

/**
 * The member record: the masthead strip at the top of the settings sheet.
 *
 * It answers "whose record am I editing" before the first field, and it prints
 * the three facts a member actually looks settings up to check: their team
 * number, their XP, and how long they have been here. Everything on it is
 * read-only, which is why it is a ruled record and not another form.
 *
 * What it replaces was a floating glass panel with a pulsing "Live" dot and
 * three numbers that counted up on mount. None of those numbers change while
 * you look at them, so the animation was saying something untrue.
 *
 * Server Component. It renders static text, so it ships no JavaScript.
 */
export function IdentityCard({
  displayName,
  handle,
  avatarUrl,
  seed,
  roleLabel,
  isAdmin,
  xp,
  teamNumber,
  joined,
}: {
  displayName: string;
  handle: string;
  avatarUrl: string | null;
  seed?: string;
  roleLabel: string;
  isAdmin: boolean;
  xp: number;
  teamNumber: number | null;
  joined: string | null;
}) {
  // `set` marks a fact that has a real value. A figure is printed in ballpoint
  // like every other count in the binder; an absent one is printed in pencil,
  // because "none on file" is not a number and should not read as one.
  const facts: { label: string; value: string; set: boolean }[] = [
    {
      label: "frc team",
      value: teamNumber ? String(teamNumber) : "none on file",
      set: teamNumber !== null,
    },
    { label: "xp earned", value: xp.toLocaleString("en-US"), set: true },
    { label: "member since", value: joined ?? "not recorded", set: joined !== null },
  ];

  return (
    // The two panels divide on the kit's 2px ink rule, which turns horizontal
    // at and below 860px. The column split has to happen on 861 EXACTLY, not
    // merely somewhere above 860: split at `lg` instead and the rule is already
    // vertical from 861 while the panels are still stacked, so the second panel
    // wears a stray ink line down its left edge and the two run together.
    <div className="nb-box grid overflow-hidden min-[861px]:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
      <div className="nb-panel">
        <p className="nb-slug">account / this is you</p>
        <div className="mt-4 flex items-center gap-4">
          <Avatar
            name={displayName}
            src={avatarUrl}
            seed={seed}
            className="h-16 w-16 shrink-0 text-[1.15rem]"
          />
          <div className="min-w-0">
            <p className="truncate text-[clamp(1.15rem,1rem+0.7vw,1.5rem)] font-extrabold leading-tight tracking-[-0.025em]">
              {displayName}
            </p>
            <p className="nb-slug mt-1 truncate">{handle}</p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <span className="nb-tag">{roleLabel}</span>
          {isAdmin && <span className="nb-tag" data-on="">admin</span>}
        </div>
      </div>

      <dl className="nb-panel justify-center gap-0">
        {facts.map((f, i) => (
          <div
            key={f.label}
            className={`flex items-baseline justify-between gap-4 py-2.5 ${
              i > 0 ? "border-t border-dashed border-rule" : ""
            }`}
          >
            <dt className="nb-slug">{f.label}</dt>
            <dd
              className={
                f.set ? "nb-count text-[1.15rem]" : "nb-slug text-right"
              }
            >
              {f.value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
