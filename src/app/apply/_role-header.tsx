import Link from "next/link";

/**
 * The two ways to help, above /apply and /apply/teach (classes-design.md
 * section 11): spreading LearnFRC (the marketing role, /apply) and teaching
 * a live class (/apply/teach). Rendered only while live classes are visible;
 * without classes, /apply has one role and needs no header.
 *
 * Two small cards rather than tabs: each is its own page with its own
 * application, and the one you're on says so in words, not only in colour.
 * No ages are printed here: the teaching page asks the age question itself,
 * and the pages leading to it stay neutral about the answer.
 */
export function RoleHeader({ active }: { active: "marketing" | "teacher" }) {
  const roles = [
    {
      id: "marketing" as const,
      href: "/apply",
      title: "Spread LearnFRC",
      text: "Show it to your team and others, share the trailer and clips.",
    },
    {
      id: "teacher" as const,
      href: "/apply/teach",
      title: "Teach a live class",
      text: "Teach a short live class on a LearnFRC lesson, to other FRC students.",
    },
  ];
  return (
    <nav aria-label="Ways to help" className="mb-[clamp(1.6rem,4vw,2.6rem)]">
      <p className="nb-slug">apply / two ways to help</p>
      <ul className="mt-3 grid gap-3 sm:grid-cols-2">
        {roles.map((r) => {
          const here = r.id === active;
          return (
            <li key={r.id} className="min-w-0">
              <Link
                href={r.href}
                aria-current={here ? "page" : undefined}
                className={`nb-box-sm block h-full p-4 no-underline ${here ? "" : "nb-lift"}`}
              >
                <span className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <span className="text-[1.02rem] font-bold text-ink">{r.title}</span>
                  <span className="nb-slug">{here ? "you’re here" : "open it"}</span>
                </span>
                <span className="mt-1.5 block text-[0.93rem] leading-snug text-graphite">{r.text}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
