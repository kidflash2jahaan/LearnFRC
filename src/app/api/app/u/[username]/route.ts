import { getPublicRecord } from "@/lib/app/public-profile";
import { levelForXp, tierFor } from "@/lib/app/levels";
import { apiError, guarded, publicOk } from "@/lib/app/http";
import { toIso } from "@/lib/app/format";

/**
 * GET /api/app/u/{username}: somebody's public record, the same reads the
 * website's /u/[username] page makes (getPublicRecord). Username, avatar,
 * team, bio, role, XP and badges only: never a real name, email or id.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ username: string }> }
) {
  return guarded(async () => {
    const { username } = await params;
    const record = await getPublicRecord(username);
    if (!record) return apiError("not_found", "There's no learner with that username.");

    const p = record.profile;
    const level = levelForXp(p.xp);
    return publicOk(
      {
        username: p.username,
        avatarUrl: p.avatar_url,
        teamNumber: p.team_number,
        bio: p.bio,
        role: p.role,
        xp: p.xp,
        level,
        tier: tierFor(level),
        createdAt: toIso(p.created_at),
        lessonCount: record.lessonCount,
        achievements: record.achievements.map((a) => ({
          slug: a.slug,
          name: a.name,
          description: a.description,
          icon: a.icon,
          earnedAt: toIso(a.earnedAt),
        })),
      },
      60,
      300
    );
  });
}
