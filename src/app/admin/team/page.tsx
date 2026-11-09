import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { loadAdminTeamDesk, type DeskApplication } from "@/lib/app/admin-team-desk";
import { CollapsiblePanel } from "@/components/admin/collapsible-panel";
import { ReviewControls } from "./_review-controls";
import { MemberControls } from "./_member-controls";

export const metadata: Metadata = {
  // The root template appends " · LearnFRC".
  title: "Team",
  robots: { index: false, follow: false },
};

/**
 * No `export const dynamic` on purpose, which is what /admin does too:
 * `getSession()` reads the auth cookie, so this route is already dynamic and a
 * second declaration of that fact is one more thing that can drift.
 */

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/**
 * `2026-07-22T23:13:50Z` to `Jul 22, 2026`.
 *
 * UTC and table-driven, the same rule /admin follows: `toLocaleDateString`
 * returns different strings on different ICU builds, and this runs in a Server
 * Component whose output is handed down as a plain string, so hydration cannot
 * disagree with it. The year is never dropped. Every date on this page is a
 * historical one, and a bare "Sep 6" on a grant made last season reads as today.
 */
function utcDay(iso: string | null): string {
  if (!iso) return "not recorded";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "not recorded";
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}

/** How long an application has been sitting there. */
function timeAgo(iso: string): string {
  const d = Date.now() - new Date(iso).getTime();
  const m = Math.round(d / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

/** One answer from the form, set at the reading measure rather than the page's. */
function Answer({ label, text }: { label: string; text: string }) {
  return (
    <div className="min-w-0">
      <p className="nb-slug">{label}</p>
      {/* `whitespace-pre-wrap` because these come out of a textarea and people
          write in paragraphs. Dropping their line breaks turns three points
          into one wall. */}
      <p className="mt-1 max-w-[68ch] break-words whitespace-pre-wrap text-[0.98rem] leading-snug">
        {text}
      </p>
    </div>
  );
}

/**
 * One old application, ruled onto the page: who it is, when it landed, then
 * both answers, then the Reject control. Nothing here is a name or an email
 * address, because loadAdminTeamDesk never returns one.
 */
function ApplicationEntry({ app }: { app: DeskApplication }) {
  const handle = app.username ? `@${app.username}` : "this account";

  return (
    <li className="nb-hair py-5 first:border-t-0 first:pt-0">
      <p className="nb-slug flex min-w-0 flex-wrap items-baseline gap-x-4 gap-y-1">
        <span className="min-w-0 max-w-full truncate font-bold text-ink">
          {app.username ? `@${app.username}` : "no username yet"}
        </span>
        <span className="whitespace-nowrap">team / {app.teamNumber ?? "not given"}</span>
        <span className="min-w-0 max-w-full truncate">
          role / {app.teamRoleLabel}
        </span>
        <span className="whitespace-nowrap">came in {timeAgo(app.createdAt)}</span>
      </p>

      {app.availability ? (
        <p className="nb-slug mt-1.5 max-w-[68ch] break-words">
          availability / {app.availability}
        </p>
      ) : null}

      <div className="mt-3.5 grid gap-3.5">
        <Answer label={"what they’ve done in FRC"} text={app.experience} />
        <Answer label="why they want to help" text={app.why} />
      </div>

      <ReviewControls id={app.id} handle={handle} />
    </li>
  );
}

/**
 * The same locked-drawer card /admin shows a signed-in non-admin, with the copy
 * this case needs: an admin who lands here has the right account, just not
 * this desk.
 */
function SuperAdminsOnly() {
  return (
    <div className="nb-route nb-wrap flex min-h-[60dvh] items-center justify-center py-20">
      <div className="nb-box nb-tilt-2 w-full max-w-lg p-[clamp(1.4rem,4vw,2.4rem)]">
        <span className="nb-tape -top-3 left-[18%] rotate-[-3.2deg]" aria-hidden="true" />
        <p className="nb-slug">access / super admins only</p>
        <h1 className="mt-3 text-[clamp(1.9rem,1.3rem+2vw,2.8rem)]">
          This one stays with the super admins.
        </h1>
        {/* Not "owner only", which the page behind this card disproves: a
            super admin can promote any admin to super admin, so this is a
            role somebody could be given rather than a fact about who bought
            the domain. Saying the wrong one leaves the reader no way to tell
            whether there is a route in. */}
        <p className="mt-4 text-graphite">
          Admins open /admin and work the numbers, the feedback inbox and the
          edit queue. Deciding who&rsquo;s on the admin team is for super
          admins. Nothing is wrong with this account.
        </p>
        <Link href="/admin" className="nb-btn mt-6">
          Back to the admin panel
        </Link>
      </div>
    </div>
  );
}

export default async function AdminTeamPage() {
  const { user, isSuperAdmin } = await getSession();
  if (!user) redirect("/login?next=/admin/team");

  if (!isSuperAdmin) return <SuperAdminsOnly />;

  // Every row below comes from loadAdminTeamDesk
  // (src/lib/app/admin-team-desk.ts), the same desk the app's
  // GET /api/app/admin/team sends. It re-checks the role itself.
  const desk = await loadAdminTeamDesk(user);
  if (!desk.ok) return <SuperAdminsOnly />;
  const { pending, team, decided } = desk;

  return (
    <div className="nb-route pb-24">
      {/* ============================ MASTHEAD ============================
          What this page is. Applying on /apply closed on 2026-11-09, so
          there's no grant card any more: nothing an application could hand
          over is left. */}
      <section className="nb-wrap pt-10 lg:pt-16">
        <p className="nb-marker">sheet / team</p>
        <h1 className="text-[clamp(2.2rem,1rem+3.4vw,3.6rem)]">
          Who&rsquo;s on the admin team.
        </h1>
        <p className="nb-lede mt-5 max-w-[60ch]">
          The admin team, and any application left from before applying
          closed. Teacher applications are decided on the{" "}
          <Link href="/admin/classes/teachers" className="nb-link">
            teacher desk
          </Link>
          .
        </p>
      </section>

      {/* ============================ THE DESK ============================
          Same shell as /admin. Old applications get a drawer only while one
          is waiting, and it opens itself: that is the one thing on this page
          that needs doing. */}
      <section className="nb-wrap mt-12 lg:mt-16">
        <p className="nb-marker">drawers / open one to read it</p>

        {pending.length > 0 ? (
          <CollapsiblePanel
            title="Old applications"
            slug="drawer / old applications"
            badge={`${pending.length} waiting`}
            defaultOpen
          >
            <p className="nb-hint mb-4">Applying here is closed. Turn these down with a short note.</p>
            <ul className="min-w-0">
              {pending.map((app) => (
                <ApplicationEntry key={app.id} app={app} />
              ))}
            </ul>
            {/* `getApplications` pages at 60. The badge counts what is
                rendered, and a badge that quietly undercounts is worse than
                a line saying so. */}
            {desk.pendingTruncated ? (
              <p className="nb-hint mt-3">
                60 shown, which is the page size. If there are more, they
                come up once you clear these.
              </p>
            ) : null}
          </CollapsiblePanel>
        ) : null}

        <CollapsiblePanel
          title="The admin team"
          slug="drawer / the admin team"
          badge={`${team.length} ${team.length === 1 ? "person" : "people"}`}
        >
          {team.length === 0 ? (
            <p className="nb-slug py-2">
              Nobody has been added yet. Your own access comes from the owner
              email in the site config rather than from this list, so you
              won&rsquo;t see yourself here.
            </p>
          ) : (
            <ul className="min-w-0">
              {team.map((m) => {
                // Owners are super admins by configuration and the action
                // refuses to touch them; so is your own row. Neither gets
                // controls (`canChange` is false), because offering a button
                // that answers "no" is worse than not offering it.
                return (
                  <li key={m.userId} className="nb-hair py-4 first:border-t-0 first:pt-0">
                    {/* The controls drop under the identity until lg, and only
                        then sit beside it: the select plus two buttons is
                        about 400px unwrapped, which at 640px would squeeze the
                        handle into a two-character column. */}
                    <div className="grid gap-x-8 gap-y-3.5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
                      <div className="min-w-0">
                        <p className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1.5">
                          <span className="min-w-0 truncate text-[0.98rem] font-bold">
                            {m.username ? `@${m.username}` : "no username yet"}
                          </span>
                          <span className="nb-slug font-bold text-ink">{m.roleWord}</span>
                          {m.isYou ? <span className="nb-tag">you</span> : null}
                        </p>
                        <p className="nb-slug mt-1 flex min-w-0 flex-wrap gap-x-4 gap-y-1">
                          <span className="whitespace-nowrap">
                            team / {m.teamNumber ?? "not given"}
                          </span>
                          <span className="whitespace-nowrap">
                            since {utcDay(m.grantedAt)}
                          </span>
                        </p>
                        {m.note ? (
                          <p className="nb-slug mt-1 max-w-[68ch] break-words">
                            note / {m.note}
                          </p>
                        ) : null}
                      </div>

                      {!m.canChange ? null : (
                        <MemberControls
                          userId={m.userId}
                          role={m.role}
                          handle={m.username ? `@${m.username}` : "this account"}
                        />
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CollapsiblePanel>

        <CollapsiblePanel title="Decided" slug="drawer / decided">
          {decided.length === 0 ? (
            <p className="nb-slug py-2">
              Nothing decided yet. Every answer you give lands here afterwards.
            </p>
          ) : (
            <>
              <ul className="min-w-0">
                {decided.map((a) => (
                  <li key={a.id} className="nb-hair py-2.5 first:border-t-0 first:pt-0">
                    <p className="nb-slug flex min-w-0 flex-wrap items-baseline gap-x-4 gap-y-1">
                      <span className="whitespace-nowrap">
                        {utcDay(a.reviewedAt ?? a.createdAt)}
                      </span>
                      <span className="min-w-0 max-w-full truncate text-ink">
                        {a.username ? `@${a.username}` : "no username yet"}
                      </span>
                      <span className="whitespace-nowrap font-bold text-ink">
                        {a.statusWord}
                      </span>
                    </p>
                    {a.reviewNote ? (
                      <p className="nb-slug mt-1 max-w-[68ch] break-words">
                        note / {a.reviewNote}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
              {desk.decidedTruncated ? (
                <p className="nb-hint mt-3">
                  The 30 most recent. Older ones are still on file,
                  they&rsquo;re just not printed here.
                </p>
              ) : null}
            </>
          )}
        </CollapsiblePanel>

        {/* Closes the last drawer off, the way a ruled page ends. */}
        <div className="nb-rule" />
      </section>
    </div>
  );
}
