import { Avatar } from "@/components/ui/avatar";

/**
 * The member card, taped into the front of the binder.
 *
 * WHAT IT WAS: a glass badge that tilted in 3D toward the cursor on a pair of
 * springs, with the avatar floating up and down forever on a five-second loop
 * and the name set in a blue-to-cyan gradient. The whole thing was a Client
 * Component to run that.
 *
 * Why none of it survived: the notebook gets its depth from a double rule and a
 * strip of tape, never from a blur or a perspective transform; nothing in it
 * moves while you are reading; and a gradient across a person's name spends two
 * colours the palette does not have on the one string that should just be
 * legible. What a real ID card has instead is a rule under the heading, a
 * photograph, a name, and a row of figures along the bottom. So that is what
 * this is, tilted the way a card taped up in a hurry ends up tilted.
 *
 * The page's `h1` lives here, because on this page the person IS the heading.
 *
 * Server Component.
 */
export function IdentityCard({
  displayName,
  handle,
  avatarUrl,
  avatarSeed,
  roleLabel,
  teamNumber,
  joinedLabel,
  bio,
  level,
  xp,
  lessonsCompleted,
}: {
  displayName: string;
  handle: string;
  avatarUrl?: string | null;
  avatarSeed?: string;
  roleLabel: string;
  teamNumber: number | null;
  joinedLabel: string;
  bio: string | null;
  level: number;
  xp: number;
  lessonsCompleted: number;
}) {
  const figures = [
    { value: level.toLocaleString(), unit: "level" },
    { value: xp.toLocaleString(), unit: "xp" },
    {
      value: lessonsCompleted.toLocaleString(),
      unit: lessonsCompleted === 1 ? "lesson" : "lessons",
    },
  ];

  return (
    <section className="nb-box nb-tilt-1 p-[clamp(1.2rem,2.8vw,2rem)]">
      <span className="nb-tape -top-3 left-[15%] rotate-[-3.4deg]" aria-hidden="true" />
      <span className="nb-tape -bottom-3 right-[12%] rotate-[2.6deg]" aria-hidden="true" />

      <p className="nb-slug border-b border-dashed border-rule pb-2.5">
        learnfrc / member card
      </p>

      <div className="mt-[clamp(1.1rem,2.4vw,1.6rem)] flex flex-wrap items-end gap-[clamp(1rem,2.4vw,1.6rem)]">
        <Avatar
          name={displayName}
          src={avatarUrl}
          seed={avatarSeed}
          className="h-24 w-24 text-[1.6rem]"
        />

        <div className="min-w-0 flex-1">
          <h1 className="text-[clamp(1.7rem,1.2rem+1.9vw,2.7rem)]">
            {displayName}
          </h1>
          <p className="nb-slug mt-1.5">@{handle}</p>
        </div>
      </div>

      <div className="mt-[clamp(1rem,2.2vw,1.4rem)] flex flex-wrap gap-2">
        <span className="nb-tag">{roleLabel}</span>
        {teamNumber != null && <span className="nb-tag">Team {teamNumber}</span>}
        <span className="nb-tag">Joined {joinedLabel}</span>
      </div>

      {bio && (
        <p className="mt-[clamp(1rem,2.2vw,1.4rem)] max-w-[54ch] text-[0.97rem] leading-relaxed text-graphite">
          {bio}
        </p>
      )}

      {/* The credential strip along the bottom edge, the way a real card runs
          its numbers under a rule. */}
      <dl className="nb-hair mt-[clamp(1.2rem,2.6vw,1.8rem)] flex flex-wrap gap-x-[clamp(1.4rem,4vw,3rem)] gap-y-3 pt-4">
        {figures.map((f) => (
          <div key={f.unit}>
            <dd className="nb-count">{f.value}</dd>
            <dt className="nb-slug mt-1">{f.unit}</dt>
          </div>
        ))}
      </dl>
    </section>
  );
}
