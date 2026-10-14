import { getProfile } from "@/lib/queries";
import { loadTeamSheet } from "@/lib/app/team";
import { teamInviteUrl } from "@/components/team/invite-link";
import { guarded, ok, requireAppUser } from "@/lib/app/http";
import { toIso } from "@/lib/app/format";

export const dynamic = "force-dynamic";

/**
 * GET /api/app/team: the caller's own team sheet, the same data the website's
 * /teams page renders (loadTeamSheet in src/lib/app/team.ts).
 *
 * The team is always the one on the caller's OWN profile; there is no way to
 * ask for another team's roster. Members are identified by username and avatar
 * only: no user ids, no real names.
 */
export async function GET(req: Request) {
  return guarded(async () => {
    const auth = await requireAppUser(req);
    if (auth instanceof Response) return auth;
    const uid = auth.user.id;

    const profile = await getProfile(uid);
    if (!profile?.team_number) return ok({ team: null });

    const sheet = await loadTeamSheet(profile.team_number, uid);
    const byId = new Map(sheet.members.map((m) => [m.userId, m]));

    return ok({
      team: {
        number: sheet.teamNumber,
        memberCount: sheet.members.length,
        totalLessons: sheet.totalLessons,
        totalCompleted: sheet.totalCompleted,
        avgPct: sheet.avgPct,
        claimedSubteams: sheet.claimedSubteams,
        totalSubteams: sheet.coverage.length,
        lessonsCovered: sheet.lessonsCovered,
        referralCount: sheet.referralCount,
        // The referral link every invite surface on the site hands out.
        inviteURL: profile.username ? teamInviteUrl(profile.username) : null,
        members: sheet.members.map((m) => ({
          username: m.username,
          name: m.name,
          avatarUrl: m.avatarUrl,
          role: m.role,
          xp: m.xp,
          isYou: m.userId === uid,
          completed: m.completed,
          lastActive: toIso(m.lastActive),
          joinedAt: toIso(m.joinedAt),
          depts: (sheet.deptProgress[m.userId] ?? []).map((d) => ({
            slug: d.slug,
            name: d.name,
            completed: d.completed,
            total: d.total,
            furthest: d.furthest,
            next: d.next,
          })),
        })),
        subteamCoverage: sheet.coverage.map((c) => ({
          slug: c.slug,
          name: c.name,
          lessonCount: c.lessonCount,
          teamCompleted: c.teamCompleted,
          members: c.members.flatMap((cm) => {
            const m = byId.get(cm.userId);
            return m
              ? [
                  {
                    username: m.username,
                    name: m.name,
                    avatarUrl: m.avatarUrl,
                    completed: cm.completed,
                    isYou: m.userId === uid,
                  },
                ]
              : [];
          }),
        })),
      },
    });
  });
}
