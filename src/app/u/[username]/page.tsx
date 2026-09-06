import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { ShareButton } from "@/components/profile/share-button";
import { RankStamp } from "./_trophy-panel";
import type { Profile } from "@/lib/types";

/**
 * Somebody's public page, rebuilt as a record of work.
 *
 * This is the one page in the account area a stranger opens, usually from a
 * link a member sent their team. So it is a single sheet, the way a signed-off
 * certificate is a single sheet: one drawn card carrying the handle, the rank
 * stamp and the share link; a ruled band of figures under it; then the badges
 * as a roster you read down.
 *
 * NO RANK COLOURS. The old page gave each of the five tiers its own hue and
 * painted the ring, the pill, the glow and the XP rail with it, which is four
 * colours this palette does not own to say a thing the word "Veteran" already
 * says. The tier is stamped in mono instead.
 *
 * Behaviour is unchanged: same `force-dynamic`, same admin client with the same
 * explicit column allow-lists, same three queries, same `notFound()`, same
 * generated metadata.
 */

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const { username } = await params;
  return {
    title: `@${username}`,
    description: `@${username}'s FRC learning profile on LearnFRC — XP, level, completed lessons, and achievements across every department.`,
    alternates: { canonical: `/u/${username}` },
    openGraph: {
      title: `@${username} · LearnFRC`,
      description: `@${username}'s FRC learning profile — XP, level, and achievements on LearnFRC.`,
      url: `/u/${username}`,
      type: "profile",
    },
  };
}

const ROLE_LABEL: Record<string, string> = {
  student: "Student",
  mentor: "Mentor",
  alum: "Alum",
  coach: "Coach",
  other: "Member",
};

/** Rank tiers earned by level. A name, not a colour: see RankStamp. */
function tierFor(level: number): string {
  if (level >= 25) return "Champion";
  if (level >= 15) return "All-Star";
  if (level >= 8) return "Veteran";
  if (level >= 3) return "Contender";
  return "Rookie";
}

export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  // Service-role, NOT the request-scoped client. `profiles` and
  // `user_achievements` are no longer SELECTable by the anon API role — that is
  // what stops a stranger from paging every account off /rest/v1 — and a
  // logged-out visitor's client IS the anon role, so this page has to read
  // server-side to stay public and indexable.
  //
  // The service-role key bypasses RLS *and* column grants, so every select
  // below is an EXPLICIT allow-list. Never `select("*")`, never `full_name`,
  // `signup_ip`, `unsubscribe_token`, or anything else that isn't rendered:
  // there is no second line of defence behind this key.
  const supabase = createAdminClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, username, avatar_url, team_number, bio, role, xp, created_at")
    .eq("username", username)
    .maybeSingle();
  if (!profile) notFound();

  const p = profile as Profile;
  // Public profile — identify by username only; real names are never public.
  const displayName = p.username || username;
  const level = Math.floor(p.xp / 100) + 1;
  const xpIntoLevel = p.xp % 100;
  const xpToNext = 100 - xpIntoLevel;
  const levelFraction = xpIntoLevel / 100;
  const tierName = tierFor(level);

  // Real completed-lesson count (lesson_progress is RLS-private → admin client).
  const { count: lessonsCount } = await supabase
    .from("lesson_progress")
    .select("*", { count: "exact", head: true })
    .eq("user_id", p.id);
  const lessons = lessonsCount ?? 0;

  const { data: ua } = await supabase
    .from("user_achievements")
    .select("earned_at, achievements(slug, name, description, icon)")
    .eq("user_id", p.id)
    .order("earned_at", { ascending: false });

  type Ach = { slug: string; name: string; description: string; icon: string };
  const achievements = (ua ?? [])
    .map((r) => {
      const a = r.achievements as unknown;
      return (Array.isArray(a) ? a[0] : a) as Ach | undefined;
    })
    .filter(Boolean) as Ach[];

  const joined = new Date(p.created_at).toLocaleDateString(undefined, {
    month: "short",
    year: "numeric",
  });

  const figures = [
    { value: p.xp.toLocaleString(), label: "xp" },
    { value: level.toLocaleString(), label: "level" },
    { value: lessons.toLocaleString(), label: lessons === 1 ? "lesson" : "lessons" },
    {
      value: achievements.length.toLocaleString(),
      label: achievements.length === 1 ? "badge" : "badges",
    },
  ];

  return (
    <>
      {/* ===================== THE RECORD SHEET =====================
          One card, the whole identity. It is the thing a screenshot of this
          page is a screenshot of, so nothing else on the sheet competes with
          it. */}
      <section className="nb-wrap pb-[clamp(2rem,4vw,3rem)] pt-[clamp(2.2rem,5vw,4rem)]">
        <div className="nb-box nb-tilt-3 mx-auto max-w-[58rem] p-[clamp(1.3rem,3vw,2.4rem)]">
          <span className="nb-tape -top-3 left-[18%] rotate-[-3.4deg]" aria-hidden="true" />
          <span className="nb-tape -bottom-3 right-[14%] rotate-[2.2deg]" aria-hidden="true" />

          <p className="nb-slug border-b border-dashed border-rule pb-2.5">
            learnfrc / record of work
          </p>

          <div className="mt-[clamp(1.2rem,2.6vw,1.8rem)] grid items-start gap-[clamp(1.4rem,3.4vw,2.6rem)] min-[760px]:grid-cols-[minmax(0,1fr)_auto]">
            <div className="min-w-0">
              <h1 className="text-[clamp(2rem,1.3rem+2.4vw,3.4rem)]">
                @{displayName}
              </h1>

              <div className="mt-[clamp(1rem,2.2vw,1.4rem)] flex flex-wrap gap-2">
                <span className="nb-tag">{ROLE_LABEL[p.role] ?? "Member"}</span>
                {p.team_number && (
                  <span className="nb-tag">Team {p.team_number}</span>
                )}
                <span className="nb-tag">Joined {joined}</span>
              </div>

              {p.bio && (
                <p className="mt-[clamp(1rem,2.2vw,1.4rem)] max-w-[54ch] text-[0.99rem] leading-relaxed text-graphite">
                  {p.bio}
                </p>
              )}
            </div>

            <div className="min-[760px]:justify-self-end">
              <RankStamp
                level={level}
                levelFraction={levelFraction}
                xpToNext={xpToNext}
                tierName={tierName}
                avatarName={displayName}
                avatarSrc={p.avatar_url}
                avatarSeed={p.id}
              />
            </div>
          </div>

          <div className="nb-hair mt-[clamp(1.4rem,3vw,2.2rem)] flex flex-wrap items-center gap-x-4 gap-y-3 pt-[clamp(1rem,2.2vw,1.4rem)]">
            <ShareButton username={username} name={displayName} />
            <p className="nb-slug">learnfrc.com/u/{displayName}</p>
          </div>
        </div>
      </section>

      {/* ===================== THE FIGURES =====================
          The one inverted surface on the page. A record sheet states its own
          totals once, in figures big enough to read from across the pit. */}
      <section className="nb-slab py-[clamp(2rem,4.5vw,3.4rem)]">
        <div className="nb-wrap grid gap-[clamp(1.2rem,3vw,2.4rem)] min-[520px]:grid-cols-2 min-[860px]:grid-cols-4">
          {figures.map((f) => (
            <p key={f.label} className="nb-stamp">
              <b>{f.value}</b>
              <span>{f.label}</span>
            </p>
          ))}
        </div>
      </section>

      {/* ===================== THE ROSTER ===================== */}
      <section className="nb-wrap py-[clamp(2.2rem,4.5vw,3.6rem)]">
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
          <div>
            <h2 className="text-[clamp(1.5rem,1.1rem+1.4vw,2.3rem)]">
              Badges earned
            </h2>
            <p className="nb-sub mt-3">
              Each one is signed off by a quiz, not by time spent on the page.
            </p>
          </div>
          {achievements.length > 0 && (
            <p className="nb-count shrink-0">
              {achievements.length}
              <small>{achievements.length === 1 ? "badge" : "badges"}</small>
            </p>
          )}
        </div>

        {achievements.length === 0 ? (
          <div className="nb-note mt-[clamp(1.2rem,2.6vw,1.8rem)] max-w-[46rem]">
            <p className="nb-slug">nothing signed off yet</p>
            <p className="mt-1.5 text-[0.95rem] leading-snug">
              The first badges land after a handful of lessons.{" "}
              <Link href="/guides" className="nb-link">
                The same catalogue
              </Link>{" "}
              is open to you, and it needs no account to read.
            </p>
          </div>
        ) : (
          <ul className="nb-list mt-[clamp(1.2rem,2.6vw,1.8rem)]">
            {achievements.map((a) => (
              <li
                key={a.slug}
                className="grid items-baseline gap-x-[clamp(1rem,3vw,2.2rem)] gap-y-1.5 border-b border-dashed border-rule py-[clamp(0.9rem,2vw,1.3rem)] min-[720px]:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]"
              >
                <h3 className="text-[1.02rem] leading-tight">{a.name}</h3>
                <p className="text-[0.93rem] leading-snug text-graphite">
                  {a.description}
                </p>
              </li>
            ))}
          </ul>
        )}

        <p className="nb-sub mt-[clamp(1.4rem,3vw,2.2rem)]">
          Everything on this page came out of{" "}
          <Link href="/guides" className="nb-link">
            394 free lessons
          </Link>
          . No account is needed to read them.
        </p>
      </section>
    </>
  );
}
