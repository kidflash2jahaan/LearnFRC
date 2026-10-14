import "server-only";
import { getProfile, getReferralCount } from "@/lib/queries";
import { isPlaceholderUsername } from "@/lib/onboarding";
import { needsUsernameSetup } from "@/lib/onboarding-server";
import { describeRhythm, rhythmMicrocopy, type Rhythm, type RhythmCopy } from "@/lib/streaks";
import { levelForXp } from "@/lib/app/levels";
import { toIso } from "@/lib/app/format";
import { shouldAskAboutEmail, toMeProfile, type MeProfile } from "@/lib/app/profile";
import {
  readBookmarks,
  readCompletions,
  readEarnedAchievements,
  readNextUnlock,
  rhythmFromCompletions,
  type NextUnlockPayload,
} from "@/lib/app/progress";
import type { AppClients, AppUser } from "@/lib/app/result";

/**
 * The signed-in user's own state, in the shapes GET /api/app/me and
 * GET /api/app/me/progress send. Built only from the shared readers the
 * website uses (getProfile, readCompletions, computeRhythm, describeRhythm,
 * readNextUnlock), so the app's numbers and words match the site's.
 */

export type MePayload = {
  user: { id: string; email: string | null };
  /** Null only if the account has no profile row (the signup trigger failed). */
  profile: MeProfile | null;
  needsUsernameSetup: boolean;
  isPlaceholderUsername: boolean;
  emailPrompt: boolean;
  referralCount: number;
};

export async function loadMe(user: AppUser): Promise<MePayload> {
  const [profile, referralCount] = await Promise.all([
    getProfile(user.id),
    getReferralCount(user.id),
  ]);
  return {
    user: { id: user.id, email: user.email ?? null },
    profile: profile ? toMeProfile(profile) : null,
    needsUsernameSetup: needsUsernameSetup(profile),
    isPlaceholderUsername: isPlaceholderUsername(profile?.username),
    emailPrompt: shouldAskAboutEmail(profile),
    referralCount,
  };
}

/** The caller's own profile object, or null if it has no row. */
export async function loadMeProfile(user: AppUser): Promise<MeProfile | null> {
  const profile = await getProfile(user.id);
  return profile ? toMeProfile(profile) : null;
}

/** Rhythm, its card copy and its one-line copy, exactly as the site words them. */
export type RhythmBundle = {
  rhythm: Rhythm;
  rhythmCopy: RhythmCopy;
  rhythmMicrocopy: string;
};

function bundle(rhythm: Rhythm): RhythmBundle {
  return { rhythm, rhythmCopy: describeRhythm(rhythm), rhythmMicrocopy: rhythmMicrocopy(rhythm) };
}

export type ProgressSnapshot = {
  completions: { lessonId: string; completedAt: string | null; xpAwarded: number }[];
  bookmarks: { lessonId: string; createdAt: string | null }[];
  earnedAchievements: { achievementId: string; slug: string | null; earnedAt: string | null }[];
  xp: number;
  level: number;
  nextUnlock: NextUnlockPayload | null;
} & RhythmBundle;

export async function loadProgressSnapshot(
  user: AppUser,
  { supabase, admin }: AppClients
): Promise<ProgressSnapshot> {
  const [rows, bookmarks, earned, profile] = await Promise.all([
    readCompletions(supabase, user.id),
    readBookmarks(supabase, user.id),
    readEarnedAchievements(admin, user.id),
    getProfile(user.id),
  ]);
  // Server clock, UTC, the same as the site's /api/me/progress.
  const { completed, rhythm } = rhythmFromCompletions(
    rows,
    profile?.created_at ?? null,
    Date.now()
  );
  const nextUnlock = await readNextUnlock(
    supabase,
    user.id,
    completed.size,
    new Set(earned.map((e) => e.achievement_id))
  );
  const xp = profile?.xp ?? 0;
  return {
    completions: rows.map((r) => ({
      lessonId: r.lesson_id,
      completedAt: toIso(r.completed_at),
      xpAwarded: r.xp_awarded ?? 0,
    })),
    bookmarks: bookmarks.map((b) => ({ lessonId: b.lesson_id, createdAt: toIso(b.created_at) })),
    earnedAchievements: earned.map((e) => ({
      achievementId: e.achievement_id,
      slug: e.slug,
      earnedAt: toIso(e.earned_at),
    })),
    xp,
    level: levelForXp(xp),
    ...bundle(rhythm),
    nextUnlock,
  };
}

/**
 * XP, level, completion count and rhythm right after a write, plus the XP the
 * given lesson's row was awarded (null when it has no row).
 */
export async function loadStateAfterWrite(
  user: AppUser,
  { supabase }: AppClients,
  lessonId: string
): Promise<
  { xp: number; level: number; completedCount: number; lessonXp: number | null } & RhythmBundle
> {
  const [rows, profile] = await Promise.all([
    readCompletions(supabase, user.id),
    getProfile(user.id),
  ]);
  const { completed, rhythm } = rhythmFromCompletions(
    rows,
    profile?.created_at ?? null,
    Date.now()
  );
  const xp = profile?.xp ?? 0;
  const row = rows.find((r) => r.lesson_id === lessonId);
  return {
    xp,
    level: levelForXp(xp),
    completedCount: completed.size,
    lessonXp: row ? (row.xp_awarded ?? 0) : null,
    ...bundle(rhythm),
  };
}
