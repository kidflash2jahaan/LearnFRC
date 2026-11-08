import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { loadReportsDesk, type DeskReport } from "@/lib/app/admin-reports";
import { ReportControls } from "./_report-controls";

export const metadata: Metadata = {
  // The root template appends " · LearnFRC".
  title: "Reports",
  robots: { index: false, follow: false },
};

/**
 * /admin/reports: what members reported about each other, and the three
 * answers to it. Everything here comes from loadReportsDesk
 * (src/lib/app/admin-reports.ts), which the app's GET /api/app/admin/reports
 * sends too, and every answer goes through the same shared functions.
 *
 * No `export const dynamic`: getSession() reads the auth cookie, so the route
 * is dynamic already (the rule /admin and /admin/team follow).
 */

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** UTC and table-driven, like /admin/team. */
function utcStamp(iso: string | null): string {
  if (!iso) return "not recorded";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "not recorded";
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${hh}:${mm} UTC`;
}

function timeAgo(iso: string | null): string {
  if (!iso) return "";
  const d = Date.now() - new Date(iso).getTime();
  const m = Math.round(d / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

/** "answer within 6h", or "overdue by 3h". */
function clock(answerBy: string | null): string {
  if (!answerBy) return "";
  const left = new Date(answerBy).getTime() - Date.now();
  const h = Math.max(1, Math.round(Math.abs(left) / 3600_000));
  return left >= 0 ? `answer within ${h}h` : `overdue by ${h}h`;
}

const SURFACE_WORD: Record<string, string> = {
  profile: "their profile",
  leaderboard: "a leaderboard",
  team: "the team sheet",
  contributions: "the change log",
};

const PLATFORM_WORD: Record<string, string> = {
  web: "the website",
  ios: "the iPhone app",
  ipados: "the iPad app",
  macos: "the Mac app",
};

/** One labelled line of what the content showed, skipped when empty. */
function Shown({ label, value }: { label: string; value: string | number | null }) {
  if (value === null || value === "") return null;
  return (
    <div className="min-w-0">
      <p className="nb-slug">{label}</p>
      <p className="mt-0.5 max-w-[68ch] break-words whitespace-pre-wrap text-[0.95rem] leading-snug">
        {value}
      </p>
    </div>
  );
}

function who(r: DeskReport): string {
  const h = r.currentUsername ?? r.reportedUsername;
  return h ? `@${h}` : "this account";
}

/** One open report: who and why, what it showed, the reporter's words, then the answers. */
function OpenReport({ r, canBan }: { r: DeskReport; canBan: boolean }) {
  const s = r.snapshot;
  const handle = who(r);
  const renamed =
    r.currentUsername && r.reportedUsername && r.currentUsername !== r.reportedUsername;
  return (
    <li className="nb-hair py-5 first:border-t-0 first:pt-0">
      <p className="nb-slug flex min-w-0 flex-wrap items-baseline gap-x-4 gap-y-1">
        <span className="min-w-0 max-w-full truncate font-bold text-ink">
          {r.accountExists && r.currentUsername ? (
            <Link href={`/u/${r.currentUsername}`} className="nb-link">
              {handle}
            </Link>
          ) : (
            handle
          )}
        </span>
        <span className="whitespace-nowrap">{r.contentKindLabel.toLowerCase()}</span>
        <span className="whitespace-nowrap">came in {timeAgo(r.createdAt)}</span>
        <span className="whitespace-nowrap font-bold text-ink">{clock(r.answerBy)}</span>
      </p>

      <h3 className="mt-2 text-[1.05rem] leading-tight">{r.reasonLabel}</h3>
      <p className="nb-slug mt-1">
        from {r.reporterUsername ? `@${r.reporterUsername}` : "a member"}, on{" "}
        {SURFACE_WORD[r.surface ?? ""] ?? "a page"}, in {PLATFORM_WORD[r.platform ?? ""] ?? "an unknown place"}
        {r.openAboutAccount > 1 ? ` / ${r.openAboutAccount} open reports about this account` : ""}
        {!r.accountExists ? " / the account is gone" : ""}
        {renamed ? ` / reported as @${r.reportedUsername}` : ""}
      </p>

      {r.details ? (
        <div className="nb-note mt-3 max-w-[62ch]">
          <p className="nb-slug">what the reporter wrote</p>
          <p className="mt-1 whitespace-pre-wrap text-[0.93rem] leading-snug">{r.details}</p>
        </div>
      ) : null}

      <div className="mt-3.5 grid gap-3">
        <p className="nb-slug">what it showed when it was reported</p>
        {r.contentKind === "profile" ? (
          <>
            <Shown label="username" value={s.username ? `@${s.username}` : null} />
            <Shown label="bio" value={s.bio} />
            <Shown label="picture" value={s.avatarUrl} />
            <Shown label="team" value={s.teamNumber} />
          </>
        ) : (
          <>
            <Shown label="on" value={s.target} />
            <Shown label="title" value={s.title} />
            <Shown label="new module" value={s.newModuleTitle} />
            <Shown label="their note" value={s.note} />
          </>
        )}
      </div>

      <ReportControls
        id={r.id}
        handle={handle}
        isProfile={r.contentKind === "profile"}
        canBan={canBan}
        accountExists={r.accountExists}
        suggestReplace={r.reason === "offensive" || r.reason === "impersonation"}
      />
    </li>
  );
}

function ClosedLine({ r }: { r: DeskReport }) {
  return (
    <li className="nb-hair flex flex-wrap items-baseline gap-x-3 gap-y-1 py-2.5">
      <span className="nb-tag">{r.statusWord}</span>
      <span className="min-w-0 flex-1 text-[0.95rem] leading-snug">
        <b>{who(r)}</b> <span className="text-graphite">/ {r.reasonLabel.toLowerCase()}</span>
        {r.resolutionNote ? (
          <span className="mt-0.5 block break-words text-[0.88rem] text-graphite">
            {r.resolutionNote}
          </span>
        ) : null}
      </span>
      <span className="nb-slug shrink-0">{utcStamp(r.resolvedAt)}</span>
    </li>
  );
}

function LockedDrawer() {
  return (
    <div className="nb-route nb-wrap flex min-h-[60dvh] items-center justify-center py-20">
      <div className="nb-box nb-tilt-2 w-full max-w-lg p-[clamp(1.4rem,4vw,2.4rem)]">
        <span className="nb-tape -top-3 left-[18%] rotate-[-3.2deg]" aria-hidden="true" />
        <p className="nb-slug">access / denied</p>
        <h1 className="mt-3 text-[clamp(1.9rem,1.3rem+2vw,2.8rem)]">This drawer is locked.</h1>
        <p className="mt-4 text-graphite">
          Reports name the people who sent them, so this desk is open to
          administrators only. Nothing is wrong with your account.
        </p>
        <Link href="/dashboard" className="nb-btn mt-6">
          Back to your dashboard
        </Link>
      </div>
    </div>
  );
}

export default async function ReportsDeskPage() {
  const { user, isAdmin } = await getSession();
  if (!user) redirect("/login?next=/admin/reports");
  if (!isAdmin) return <LockedDrawer />;

  const desk = await loadReportsDesk(user);
  if (!desk.ok) {
    if (desk.code === "forbidden") return <LockedDrawer />;
    return (
      <div className="nb-wrap py-16">
        <p className="nb-error">{desk.error}</p>
      </div>
    );
  }

  return (
    <div className="nb-route pb-24">
      <section className="nb-wrap pt-10 lg:pt-16">
        <p className="nb-slug">
          <Link href="/admin" className="nb-link">
            admin
          </Link>{" "}
          / reports
        </p>
        <p className="nb-marker mt-3">sheet / reports</p>
        <h1 className="text-[clamp(2.2rem,1rem+3.4vw,3.4rem)]">
          What members flagged, and what was done.
        </h1>
        <p className="nb-lede mt-5 max-w-[60ch]">
          Every report gets an answer within {desk.answerWithinHours} hours of
          coming in. Close it when there&rsquo;s nothing to take down, remove the
          content when there is, and ban the account when it shouldn&rsquo;t be
          here at all. The person reported is never told who sent it.
        </p>
        {!desk.canBan ? (
          <p className="nb-hint mt-3 max-w-[60ch]">
            Banning deletes an account for good, so it&rsquo;s a super
            admin&rsquo;s call. If an account needs banning, leave the report
            open and tell a super admin.
          </p>
        ) : null}
      </section>

      <section className="nb-wrap mt-12">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
          <h2 className="text-[clamp(1.5rem,1.1rem+1.4vw,2.3rem)]">Waiting on a person</h2>
          <p className="nb-count shrink-0">
            {desk.openCount}
            <small>open</small>
          </p>
        </div>
        {desk.open.length === 0 ? (
          <div className="nb-note max-w-[46rem]">
            <p className="nb-slug">desk / clear</p>
            <p className="mt-1.5 text-[0.95rem] leading-snug">
              Nothing is waiting. New reports land here and in your inbox.
            </p>
          </div>
        ) : (
          <ul className="max-w-[58rem]">
            {desk.open.map((r) => (
              <OpenReport key={r.id} r={r} canBan={desk.canBan} />
            ))}
          </ul>
        )}
      </section>

      {desk.closed.length > 0 ? (
        <section className="nb-wrap mt-14 border-t-2 border-ink pt-[clamp(2rem,4vw,3rem)]">
          <h2 className="text-[clamp(1.5rem,1.1rem+1.4vw,2.3rem)]">Recently answered</h2>
          <p className="nb-sub mt-3">The last {desk.closed.length}, newest first. Each one is in the moderation log too.</p>
          <ul className="mt-5 max-w-[58rem]">
            {desk.closed.map((r) => (
              <ClosedLine key={r.id} r={r} />
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
