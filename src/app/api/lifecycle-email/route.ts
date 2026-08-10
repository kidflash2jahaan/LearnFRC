import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  sendEmail,
  lifecycleEmailHtml,
  lifecycleEmailSubject,
  type LifecycleSegment,
  type LifecycleEmailProps,
} from "@/lib/email";
import { getLessonContent } from "@/lib/queries";
import { orderedLessons } from "./catalog";
import {
  DAY,
  decide,
  isDeliverable,
  pickNextLesson,
  summarise,
  emptyProgress,
  type CatalogLesson,
  type ProgressSummary,
} from "./segments";

export const dynamic = "force-dynamic";

/**
 * Automatic, recurring win-back email. Runs on a schedule (vercel.json, daily);
 * on each run it emails a small batch of ELIGIBLE lapsed learners and never a
 * mass blast. Eligibility is deliberately conservative for legal + reputation
 * safety:
 *   - email_opt_in = true (opt-out model; unsubscribe flips this)
 *   - email is CONFIRMED (an unconfirmed account cannot sign in at all, so
 *     mailing it can never lead anywhere useful)
 *   - lapsed on BOTH signals — no completion and no presence heartbeat
 *   - throttled, with the throttle widening as the learner goes colder
 *   - hard stop past GIVE_UP_DORMANT_DAYS: we do not mail forever
 *
 * Segmentation lives in ./segments.ts. The three lanes get three genuinely
 * different emails; see LifecycleSegment for what separates them.
 *
 * GET/POST ?secret=CRON_SECRET
 *   &dry=1            report the target list, send nothing
 *   &preview=<lane>   render one lane's HTML in the browser, send nothing
 *   &test=<email>     send ONE sample to that address and stop
 * LIFECYCLE_DRY_RUN=1 in the environment forces dry mode for every run.
 */

const MAX_PER_RUN = 40; // stay well under Resend's 100/day free cap

/** Per-lane ceilings, so the 156-account never_started backfill can't swallow a
 * whole run and starve the lanes with demonstrated affinity. Lanes are filled
 * in descending order of measured yield: deep_churn first, never_started last.
 * At today's volumes the backfill drains over about a week, which is also a far
 * safer sending pattern than one large blast from a young domain. */
const LANE_ORDER: LifecycleSegment[] = [
  "deep_churn",
  "stalled_early",
  "never_started",
];
const LANE_CAP: Record<LifecycleSegment, number> = {
  deep_churn: 20,
  stalled_early: 20,
  // ENABLED at Jahaan's explicit instruction (2026-08-10). This lane reaches the
  // ~116 accounts that signed up and never finished a lesson — people who opted
  // in at signup and have, until now, never been contacted at all, because the
  // old query structurally excluded every zero-completion user.
  // The copy was corrected before switching this on: it previously claimed the
  // reader "hasn't opened a lesson yet", which is unknowable — lesson_progress
  // records only COMPLETIONS, so someone who opened ten and finished none sits
  // in this segment. It now says "finished", which is exactly what we know.
  // Guardrails that make the volume safe: 25/run against MAX_PER_RUN 40, filled
  // last in LANE_ORDER, once-ever per account, email_opt_in respected, and a
  // one-click unsubscribe in every message.
  never_started: 25,
};

function authed(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const url = new URL(req.url);
  // Vercel Cron sends `Authorization: Bearer <CRON_SECRET>` automatically, so
  // the secret never has to live in vercel.json. Also accept the manual forms.
  return (
    req.headers.get("authorization") === `Bearer ${secret}` ||
    url.searchParams.get("secret") === secret ||
    req.headers.get("x-cron-secret") === secret
  );
}

const maskEmail = (e: string) => e.replace(/(.).*(@.*)/, "$1***$2");

type Candidate = {
  id: string;
  email: string;
  segment: LifecycleSegment;
  dormantDays: number;
  /** The lesson `props` points at — needed to load its real read time/quiz. */
  nextLessonId: string;
  props: LifecycleEmailProps;
};

const LANES = ["never_started", "stalled_early", "deep_churn"] as const;
const asLane = (v: string | null): LifecycleSegment | null =>
  LANES.find((l) => l === v) ?? null;

/** A plausible learner in a given lane, for ?preview / ?test rendering only. */
function sampleProgress(
  segment: LifecycleSegment,
  catalog: CatalogLesson[]
): ProgressSummary {
  const p = emptyProgress();
  if (segment === "never_started") return p;
  const take = segment === "deep_churn" ? 14 : 3;
  for (const l of catalog.slice(0, take)) p.lessonIds.add(l.id);
  p.completed = take;
  p.activeDays = segment === "deep_churn" ? 4 : 1;
  p.lastCompletedAt = Date.now() - 9 * DAY;
  p.lastLessonId = catalog[take - 1]?.id ?? null;
  return p;
}

/**
 * Build the email props for one learner out of their real rows. Every field is
 * measured; nothing here is estimated or invented.
 */
function buildProps(args: {
  site: string;
  segment: LifecycleSegment;
  now: number;
  name: string | null;
  username: string | null;
  token: string;
  progress: ProgressSummary;
  catalog: CatalogLesson[];
}): { props: LifecycleEmailProps; lessonId: string } | null {
  const { site, segment, now, name, username, token, progress, catalog } = args;
  const next = pickNextLesson(catalog, progress);
  // Nothing left to recommend (they've finished the catalog) — there is no
  // useful, non-promotional thing to say, so we say nothing.
  if (!next) return null;

  const lastLessonTitle = progress.lastLessonId
    ? (catalog.find((l) => l.id === progress.lastLessonId)?.title ?? null)
    : null;

  const props: LifecycleEmailProps = {
    segment,
    name,
    unsubscribeUrl: `${site}/unsubscribe?token=${encodeURIComponent(token)}`,
    nextLessonTitle: next.lesson.title,
    nextLessonHref: next.lesson.href,
    nextLessonSummary: next.lesson.summary,
    departmentName: next.lesson.departmentName,
    departmentDone: next.departmentDone,
    departmentTotal: next.departmentTotal,
    completed: progress.completed,
    activeDays: progress.activeDays,
    daysSinceLastLesson:
      progress.lastCompletedAt === null
        ? null
        : Math.floor((now - progress.lastCompletedAt) / DAY),
    lastLessonTitle,
    // The referral ask is gated inside the template on deep_churn, matching the
    // dashboard's own 5-lesson INVITE_EARNED_AT. &via=email keeps the lifecycle
    // mail measurable separately from every other invite surface.
    inviteUrl: username
      ? `${site}/signup?ref=${encodeURIComponent(username)}&via=email`
      : null,
  };
  return { props, lessonId: next.lesson.id };
}

/**
 * never_started learners have no history to personalise from, so their email is
 * built around one starter lesson. We enrich it with the real read time and the
 * real quiz length — the same word-count formula the lesson page renders, not
 * lessons.estimated_minutes, which overstates reading time by roughly 14x and
 * would turn an honest "about 2 minutes" into a bounce-inducing "25 min read".
 */
async function starterProps(
  base: LifecycleEmailProps,
  lessonId: string
): Promise<LifecycleEmailProps> {
  const body = await getLessonContent(lessonId).catch(() => null);
  if (!body) return base;
  const words = body.content?.split(/\s+/).filter(Boolean).length ?? 0;
  return {
    ...base,
    readMinutes: words ? Math.max(1, Math.round(words / 200)) : null,
    quizQuestions: Array.isArray(body.quiz) ? body.quiz.length : null,
  };
}

async function run(req: Request) {
  if (!authed(req)) return new NextResponse(null, { status: 401 });

  const url = new URL(req.url);
  const site = process.env.NEXT_PUBLIC_SITE_URL || "https://learnfrc.com";
  // Env kill-switch beats the query string: if LIFECYCLE_DRY_RUN is set the job
  // can be left scheduled and observed without a single message going out.
  const dry =
    url.searchParams.get("dry") === "1" ||
    process.env.LIFECYCLE_DRY_RUN === "1";

  const catalog = await orderedLessons();

  // ?preview=<lane> — render a lane's real HTML and return it. Sends nothing,
  // touches no user rows; this is how the templates get reviewed.
  /** Render one lane against a synthetic learner. Shared by ?preview and ?test
   * so the previewed email is byte-identical to the tested one. */
  const renderSample = async (segment: LifecycleSegment, name: string | null) => {
    const built = buildProps({
      site,
      segment,
      now: Date.now(),
      name,
      username: name ? name.toLowerCase() : null,
      token: "preview",
      progress: sampleProgress(segment, catalog),
      catalog,
    });
    if (!built) return null;
    return segment === "never_started"
      ? await starterProps(built.props, built.lessonId)
      : built.props;
  };

  const preview = url.searchParams.get("preview");
  if (preview) {
    const segment = asLane(preview);
    if (!segment)
      return NextResponse.json(
        { ok: false, error: `preview must be one of ${LANES.join(", ")}` },
        { status: 400 }
      );
    const props = await renderSample(segment, "Sam");
    if (!props)
      return NextResponse.json({ ok: false, error: "no catalog" }, { status: 500 });
    return new NextResponse(lifecycleEmailHtml(props), {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "X-Robots-Tag": "noindex",
        // Subjects contain em dashes; header values are ByteStrings, so a raw
        // subject here throws ERR_INVALID_CHAR and 500s the whole preview.
        "X-Lifecycle-Subject": encodeURIComponent(lifecycleEmailSubject(props)),
      },
    });
  }

  // ?test=you@example.com&lane=<lane> — send ONE sample to that address and
  // stop, so the founder can check a real inbox without touching any user.
  const test = url.searchParams.get("test");
  if (test && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(test)) {
    const segment = asLane(url.searchParams.get("lane")) ?? "deep_churn";
    if (dry)
      return NextResponse.json({ ok: true, dryRun: true, wouldTest: test, segment });
    if (!process.env.RESEND_API_KEY)
      return NextResponse.json({ ok: false, skipped: "no RESEND_API_KEY" });
    const props = await renderSample(segment, null);
    if (!props) return NextResponse.json({ ok: false, error: "no catalog" });
    const res = await sendEmail({
      to: test,
      subject: lifecycleEmailSubject(props),
      html: lifecycleEmailHtml(props),
    });
    return NextResponse.json({
      ok: res.ok,
      sentTestTo: test,
      segment,
      error: res.error,
    });
  }

  // These are RELATIONSHIP emails (a registered learner's own account activity
  // and their own next lesson, strictly non-promotional) — under CAN-SPAM's
  // primary-purpose test that category doesn't require a physical postal
  // address. We still ship a one-click unsubscribe as courtesy.
  if (!dry && !process.env.RESEND_API_KEY) {
    return NextResponse.json({ ok: false, skipped: "no RESEND_API_KEY" });
  }

  const admin = createAdminClient();
  const now = Date.now();

  // 1) auth users -> confirmed email map
  const emailById = new Map<string, string>();
  let unconfirmed = 0;
  for (let page = 1; page <= 20; page++) {
    const { data } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    const users = data?.users ?? [];
    for (const u of users) {
      if (!u.email) continue;
      if (u.email_confirmed_at || u.confirmed_at) emailById.set(u.id, u.email);
      else unconfirmed++;
    }
    if (users.length < 1000) break;
  }

  // 2) opted-in profiles. PAGED: PostgREST silently truncates any select at
  // 1000 rows, and an unpaged read here would mean everyone past row 1000 is
  // never emailed again, with no error anywhere.
  type ProfileRow = {
    id: string;
    username: string | null;
    full_name: string | null;
    unsubscribe_token: string;
    last_lifecycle_email_at: string | null;
    last_seen_at: string | null;
    created_at: string;
  };
  const profs: ProfileRow[] = [];
  for (let from = 0; ; from += 1000) {
    const { data } = await admin
      .from("profiles")
      .select(
        "id, username, full_name, unsubscribe_token, last_lifecycle_email_at, last_seen_at, created_at"
      )
      .eq("email_opt_in", true)
      .order("id", { ascending: true })
      .range(from, from + 999);
    const chunk = (data ?? []) as ProfileRow[];
    profs.push(...chunk);
    if (chunk.length < 1000) break;
  }

  // 3) progress -> per-user rows (paged)
  const rowsByUser = new Map<
    string,
    { lesson_id: string | null; completed_at: string | null }[]
  >();
  for (let from = 0; ; from += 1000) {
    const { data } = await admin
      .from("lesson_progress")
      .select("user_id, lesson_id, completed_at")
      .order("id", { ascending: true })
      .range(from, from + 999);
    const chunk = (data ?? []) as {
      user_id: string;
      lesson_id: string | null;
      completed_at: string | null;
    }[];
    for (const r of chunk) {
      const arr = rowsByUser.get(r.user_id);
      if (arr) arr.push(r);
      else rowsByUser.set(r.user_id, [r]);
    }
    if (chunk.length < 1000) break;
  }

  const byLane: Record<LifecycleSegment, Candidate[]> = {
    never_started: [],
    stalled_early: [],
    deep_churn: [],
  };
  const skips = new Map<string, number>();
  const noteSkip = (r: string) => skips.set(r, (skips.get(r) ?? 0) + 1);

  for (const p of profs) {
    const email = emailById.get(p.id);
    if (!email) {
      noteSkip("email never confirmed");
      continue;
    }
    // A reserved-TLD address can only hard bounce, and hard bounces are what
    // cost a young domain its deliverability. Never spend one on them.
    if (!isDeliverable(email)) {
      noteSkip("undeliverable address (reserved TLD)");
      continue;
    }
    const progress = summarise(rowsByUser.get(p.id) ?? []);
    const d = decide({
      now,
      createdAt: new Date(p.created_at).getTime(),
      lastSeenAt: p.last_seen_at ? new Date(p.last_seen_at).getTime() : null,
      lastEmailedAt: p.last_lifecycle_email_at
        ? new Date(p.last_lifecycle_email_at).getTime()
        : null,
      progress,
    });
    if (!d.send) {
      noteSkip(d.skip);
      continue;
    }
    const built = buildProps({
      site,
      segment: d.segment,
      now,
      name: p.full_name || p.username || null,
      username: p.username,
      token: p.unsubscribe_token,
      progress,
      catalog,
    });
    if (!built) {
      noteSkip("finished the whole catalog");
      continue;
    }
    byLane[d.segment].push({
      id: p.id,
      email,
      segment: d.segment,
      dormantDays: d.dormantDays,
      nextLessonId: built.lessonId,
      props: built.props,
    });
  }

  // Freshest first inside each lane — the least-dormant learner in a lane is
  // the most recoverable one, and gets this run's slot.
  const batch: Candidate[] = [];
  for (const lane of LANE_ORDER) {
    const room = Math.min(LANE_CAP[lane], MAX_PER_RUN - batch.length);
    if (room <= 0) break;
    byLane[lane].sort((a, b) => a.dormantDays - b.dormantDays);
    batch.push(...byLane[lane].slice(0, room));
  }

  const laneCounts = {
    deep_churn: byLane.deep_churn.length,
    stalled_early: byLane.stalled_early.length,
    never_started: byLane.never_started.length,
  };
  const totalEligible =
    laneCounts.deep_churn + laneCounts.stalled_early + laneCounts.never_started;

  if (dry) {
    // Log the full target list server-side (masked) and return a summary. This
    // is the verification path — nothing is sent and no row is written.
    for (const c of batch) {
      console.log(
        `[lifecycle:dry] ${c.segment} ${maskEmail(c.email)} dormant=${c.dormantDays}d ` +
          `completed=${c.props.completed} next="${c.props.nextLessonTitle}" ` +
          `dept=${c.props.departmentName} subject="${lifecycleEmailSubject(c.props)}"`
      );
    }
    return NextResponse.json({
      ok: true,
      dryRun: true,
      forcedByEnv: process.env.LIFECYCLE_DRY_RUN === "1",
      optedInProfiles: profs.length,
      unconfirmedAuthUsers: unconfirmed,
      totalEligible,
      eligibleByLane: laneCounts,
      wouldSend: batch.length,
      wouldSendByLane: LANE_ORDER.reduce<Record<string, number>>((a, l) => {
        a[l] = batch.filter((b) => b.segment === l).length;
        return a;
      }, {}),
      skipped: Object.fromEntries([...skips.entries()].sort((a, b) => b[1] - a[1])),
      sample: batch.slice(0, 6).map((b) => ({
        to: maskEmail(b.email),
        lane: b.segment,
        dormantDays: b.dormantDays,
        completed: b.props.completed,
        subject: lifecycleEmailSubject(b.props),
        next: b.props.nextLessonTitle,
        department: b.props.departmentName,
      })),
    });
  }

  let sent = 0;
  const sentByLane: Record<string, number> = {};
  for (const c of batch) {
    const props =
      c.segment === "never_started"
        ? await starterProps(c.props, c.nextLessonId)
        : c.props;
    const res = await sendEmail({
      to: c.email,
      subject: lifecycleEmailSubject(props),
      html: lifecycleEmailHtml(props),
    });
    if (res.ok) {
      sent++;
      sentByLane[c.segment] = (sentByLane[c.segment] ?? 0) + 1;
      // Stamped on every successful send. For never_started this stamp is also
      // what makes the lane once-ever: with zero completions the learner can
      // never satisfy `lastEmailedAt === null` again.
      await admin
        .from("profiles")
        .update({ last_lifecycle_email_at: new Date().toISOString() })
        .eq("id", c.id);
    }
  }

  return NextResponse.json({
    ok: true,
    totalEligible,
    eligibleByLane: laneCounts,
    sent,
    sentByLane,
  });
}

export const GET = run;
export const POST = run;
