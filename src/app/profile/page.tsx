import Link from "next/link";
import { redirect } from "next/navigation";
import { needsUsernameSetup } from "@/lib/onboarding-server";
import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getCompletedLessonIds, getReferralCount } from "@/lib/queries";
import type { Achievement } from "@/lib/types";
import { IdentityCard } from "./_identity-card";

/**
 * Your own profile, rebuilt as the record page.
 *
 * The question this page answers is "what does this account have on file, and
 * what can I change", so it is built out of the two things a binder uses for
 * exactly that: a spec sheet and a checklist. The member card carries the
 * identity, the table carries every figure once, and the badges are a checked
 * list rather than a wall of tiles, because a list is what you read down when
 * you want to know what is left.
 *
 * It deliberately shares no composition with /dashboard. The dashboard is the
 * page you work from; this is the page you look yourself up on.
 *
 * Behaviour is unchanged: same auth gate, same handle gate, same three queries,
 * same referral count, same metadata.
 */

export const metadata = {
  title: "Your profile · LearnFRC",
  description: "Your XP, level, completed lessons, and achievements on LearnFRC.",
  robots: { index: false, follow: false },
};

const ROLE_LABEL: Record<string, string> = {
  student: "Student",
  mentor: "Mentor",
  alum: "Alum",
  coach: "Coach",
  other: "Member",
};

function formatJoined(iso: string | null): string {
  if (!iso) return "not recorded";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

export default async function ProfilePage() {
  const { user, profile } = await getSession();
  if (!user) redirect("/login?next=/profile");
  // Required handle: hold them on the setup step (see onboarding-server.ts).
  if (needsUsernameSetup(profile)) redirect("/dashboard");

  const supabase = await createClient();

  // Own data: real completed-lesson count + earned achievements joined to catalog.
  const [completedIds, earnedRes, catalogRes] = await Promise.all([
    getCompletedLessonIds(user.id),
    supabase
      .from("user_achievements")
      .select("achievement_id, earned_at")
      .eq("user_id", user.id),
    supabase.from("achievements").select("*").order("sort_order"),
  ]);

  const lessonsCompleted = completedIds.size;
  const xp = profile?.xp ?? 0;
  const level = Math.floor(xp / 100) + 1;
  const intoLevel = xp % 100; // 0..99 XP toward next level
  const toNext = 100 - intoLevel;

  const catalog = (catalogRes.data as Achievement[] | null) ?? [];
  const earnedAtById = new Map<string, string>(
    (earnedRes.data ?? []).map((r) => [r.achievement_id as string, r.earned_at as string])
  );
  const achievements = catalog.map((a) => ({
    ...a,
    earned: earnedAtById.has(a.id),
    earnedAt: earnedAtById.get(a.id) ?? null,
  }));
  const earnedCount = achievements.filter((a) => a.earned).length;

  const displayName =
    profile?.full_name || profile?.username || user.email?.split("@")[0] || "You";
  const roleLabel = ROLE_LABEL[profile?.role ?? "student"] ?? "Member";
  const handle = profile?.username || "you";

  // How many teammates this member has recruited (shown only when > 0).
  const referralCount = await getReferralCount(user.id);

  // Every figure on this page, printed once. A table, because that is what a
  // spec sheet is, and because it lets the third column say what a bare number
  // never can: how the figure was arrived at.
  const sheet: { label: string; value: string; note: React.ReactNode }[] = [
    {
      label: "total xp",
      value: xp.toLocaleString(),
      note: "10 XP a lesson, more on a streak",
    },
    {
      label: "level",
      value: level.toLocaleString(),
      note: `${toNext} XP to level ${level + 1}`,
    },
    {
      label: "lessons cleared",
      value: lessonsCompleted.toLocaleString(),
      note: (
        <Link href="/guides" className="nb-link">
          the catalogue
        </Link>
      ),
    },
    {
      label: "badges earned",
      value: `${earnedCount} / ${achievements.length}`,
      note: "the checklist below",
    },
    { label: "role", value: roleLabel, note: "set in settings" },
    {
      label: "team",
      value: profile?.team_number != null ? `#${profile.team_number}` : "not set",
      note:
        profile?.team_number != null ? (
          "printed beside your name on the leaderboard"
        ) : (
          <Link href="/settings" className="nb-link">
            add it in settings
          </Link>
        ),
    },
    {
      label: "member since",
      value: formatJoined(profile?.created_at ?? null),
      note: "the day the account was made",
    },
    {
      label: "handle",
      value: `@${handle}`,
      note: profile?.username ? (
        <Link href={`/u/${profile.username}`} className="nb-link">
          learnfrc.com/u/{profile.username}
        </Link>
      ) : (
        "not set"
      ),
    },
  ];

  return (
    <>
      {/* ===================== THE CARD ===================== */}
      <section className="nb-wrap pb-[clamp(2rem,4vw,3rem)] pt-[clamp(2.2rem,5vw,4rem)]">
        <p className="nb-marker">your record</p>

        <div className="grid items-start gap-[clamp(1.4rem,3.4vw,2.6rem)] min-[1024px]:grid-cols-[minmax(0,1.4fr)_minmax(0,0.78fr)]">
          <IdentityCard
            displayName={displayName}
            handle={handle}
            avatarUrl={profile?.avatar_url}
            avatarSeed={profile?.username || user.email || undefined}
            roleLabel={roleLabel}
            teamNumber={profile?.team_number ?? null}
            joinedLabel={formatJoined(profile?.created_at ?? null)}
            bio={profile?.bio ?? null}
            level={level}
            xp={xp}
            lessonsCompleted={lessonsCompleted}
          />

          {/* The two things that are actually editable, and the one number that
              belongs to nobody else on the page. */}
          <nav
            aria-labelledby="profile-actions-heading"
            className="nb-box p-[clamp(1.1rem,2.4vw,1.6rem)]"
          >
            <h2 id="profile-actions-heading" className="nb-slug">
              what you can change
            </h2>

            <ul className="mt-3">
              <li className="border-t-2 border-ink pt-3">
                <Link href="/settings" className="group block">
                  <span className="block text-[1.02rem] font-bold leading-tight group-hover:underline group-hover:decoration-blue group-hover:decoration-2 group-hover:underline-offset-[5px]">
                    Edit your profile
                  </span>
                  <span className="mt-1 block text-[0.9rem] leading-snug text-graphite">
                    Name, team number, role, bio and avatar.
                  </span>
                </Link>
              </li>

              {profile?.username && (
                <li className="mt-4 border-t-2 border-ink pt-3">
                  <Link href={`/u/${profile.username}`} className="group block">
                    <span className="block text-[1.02rem] font-bold leading-tight group-hover:underline group-hover:decoration-blue group-hover:decoration-2 group-hover:underline-offset-[5px]">
                      Your public page
                    </span>
                    <span className="mt-1 block text-[0.9rem] leading-snug text-graphite">
                      What a teammate sees at the link you share. Your real name
                      is never on it.
                    </span>
                  </Link>
                </li>
              )}
            </ul>

            {referralCount > 0 && (
              <p className="nb-hair mt-5 pt-4">
                <span className="nb-count">
                  {referralCount}
                  <small>
                    {referralCount === 1
                      ? "teammate you brought in"
                      : "teammates you brought in"}
                  </small>
                </span>
              </p>
            )}
          </nav>
        </div>
      </section>

      {/* ===================== THE SPEC SHEET ===================== */}
      <section className="nb-wrap border-t-2 border-ink py-[clamp(2.2rem,4.5vw,3.6rem)]">
        <h2 className="text-[clamp(1.5rem,1.1rem+1.4vw,2.3rem)]">
          Everything on file
        </h2>
        <p className="nb-sub mt-3">
          Every figure this account holds, printed once. Nothing here is shared
          with anyone unless you send them your handle.
        </p>

        {/* Wrapped, because a table is the one thing on this site that can be
            wider than the page it is on. */}
        <div className="nb-scroll mt-[clamp(1.2rem,2.6vw,1.8rem)]">
          <table className="nb-table min-w-[34rem]">
            <thead>
              <tr>
                <th scope="col">figure</th>
                <th scope="col">value</th>
                <th scope="col">where it comes from</th>
              </tr>
            </thead>
            <tbody>
              {sheet.map((r) => (
                <tr key={r.label}>
                  <th scope="row" className="font-normal">
                    {r.label}
                  </th>
                  <td className="font-mono font-bold">{r.value}</td>
                  <td className="text-[0.94rem] text-graphite">{r.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ===================== THE CHECKLIST =====================
          Badges as a list you read down, not a wall you scan. State is marked
          twice on every line: the mono box is ticked or empty AND the line says
          which it is, so it survives a photocopy. */}
      <section className="nb-wrap border-t-2 border-ink py-[clamp(2.2rem,4.5vw,3.6rem)]">
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
          <div>
            <h2 className="text-[clamp(1.5rem,1.1rem+1.4vw,2.3rem)]">Badges</h2>
            <p className="nb-sub mt-3">
              {earnedCount > 0
                ? `${earnedCount} of ${achievements.length} ticked off.`
                : "None ticked off yet. Every one of them comes out of lessons you were going to read anyway."}
            </p>
          </div>
          <p className="nb-count shrink-0">
            {earnedCount}
            <small>of {achievements.length}</small>
          </p>
        </div>

        {achievements.length === 0 ? (
          <p className="nb-sub mt-[clamp(1.2rem,2.6vw,1.8rem)]">
            The badge list is empty right now. It fills back in when the next
            season's set is published.
          </p>
        ) : (
          <ul className="nb-list mt-[clamp(1.2rem,2.6vw,1.8rem)]">
            {achievements.map((a) => (
              <li
                key={a.id}
                className="grid items-baseline gap-x-[clamp(1rem,3vw,2.2rem)] gap-y-1.5 border-b border-dashed border-rule py-[clamp(0.85rem,1.9vw,1.25rem)] min-[720px]:grid-cols-[minmax(0,13rem)_minmax(0,1fr)]"
              >
                <p className="nb-slug">
                  <span aria-hidden="true">{a.earned ? "[x] " : "[ ] "}</span>
                  {a.earned
                    ? a.earnedAt
                      ? `earned ${new Date(a.earnedAt).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}`
                      : "earned"
                    : "not yet"}
                </p>

                <div className="min-w-0">
                  <h3
                    className={
                      a.earned
                        ? "text-[1.02rem] leading-tight"
                        : "text-[1.02rem] leading-tight text-graphite"
                    }
                  >
                    {a.name}
                  </h3>
                  <p className="mt-1 text-[0.9rem] leading-snug text-graphite">
                    {a.description}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
