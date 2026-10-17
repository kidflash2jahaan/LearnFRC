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

/** One line of the taped card: the thing, and what it lets them do. */
function GrantRow({ label, hint }: { label: string; hint: string }) {
  return (
    <li className="border-t border-[rgba(22,24,27,0.13)] py-2.5 first:border-t-0">
      <span className="block text-[0.95rem] leading-snug">{label}</span>
      <span className="nb-slug mt-0.5 block">{hint}</span>
    </li>
  );
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
 * One application, ruled onto the page: who it is, when it landed, then both
 * answers, then the two controls. Nothing here is a name or an email address,
 * because loadAdminTeamDesk never returns one.
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
          edit queue. Deciding who else gets that access is a super
          admin&rsquo;s job, and this account isn&rsquo;t one. Nothing is
          wrong with it.
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
  const { grants, pending, team, decided } = desk;

  return (
    <div className="nb-route pb-24">
      {/* ============================ MASTHEAD ============================
          What this page is on the left, what saying yes actually costs on the
          right. The grant is on the cover sheet rather than buried in a note,
          because it is the whole content of the decision below. */}
      <section className="nb-wrap pt-10 lg:pt-16">
        <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,0.9fr)] lg:gap-16">
          <div>
            <p className="nb-marker">sheet / team</p>
            <h1 className="text-[clamp(2.2rem,1rem+3.4vw,3.6rem)]">
              Who else can open the drawer.
            </h1>
            <p className="nb-lede mt-5">
              Applications land here, and so does everyone already let in. Read
              both answers before you decide, because the access is real.
            </p>
          </div>

          <div>
            <div className="nb-box nb-tilt-1 p-[clamp(1.15rem,2.4vw,1.65rem)]">
              <span className="nb-tape -top-3 left-[20%] rotate-[-3.4deg]" aria-hidden="true" />
              <span className="nb-tape -bottom-3 right-[14%] rotate-[2.6deg]" aria-hidden="true" />

              <p className="nb-slug border-b border-dashed border-rule pb-3">
                what accepting hands over
              </p>
              <ul className="mt-1">
                {grants.map((g) => (
                  <GrantRow key={g.label} label={g.label} hint={g.hint} />
                ))}
              </ul>
              <p className="mt-4 border-t border-dashed border-rule pt-3 text-[0.9rem] leading-relaxed text-graphite">
                No real names and no email addresses appear anywhere in that
                panel, on purpose. They get an email whichever way you answer,
                and whatever you write in the note goes in it.
              </p>
            </div>
            <p className="nb-pen mt-4 rotate-[-1.2deg]">
              removing an admin is easy, a rejection is not
            </p>
          </div>
        </div>
      </section>

      {/* ============================ THE DESK ============================
          Three drawers, same shell as /admin. The one with something waiting
          opens itself: this page has exactly one reason to be visited, and
          making the owner click twice to reach it is the wrong default.
          No section heading above them, because each drawer already prints its
          own h2 and a fourth heading between the h1 and those would label
          nothing that the drawer titles do not. */}
      <section className="nb-wrap mt-12 lg:mt-16">
        <p className="nb-marker">drawers / open one to read it</p>

        <CollapsiblePanel
          title="Applications"
          slug="drawer / applications"
          badge={pending.length > 0 ? `${pending.length} waiting` : undefined}
          defaultOpen={pending.length > 0}
        >
          {pending.length === 0 ? (
            <p className="nb-slug py-2">
              Nobody is waiting. Applications come in from{" "}
              <Link href="/apply" className="nb-link">
                /apply
              </Link>
              .
            </p>
          ) : (
            <>
              <ul className="min-w-0">
                {pending.map((app) => (
                  <ApplicationEntry key={app.id} app={app} />
                ))}
              </ul>
              {/* `getApplications` pages at 60. Nobody can hold two pending
                  applications at once, so hitting this is unlikely, but the
                  badge counts what is rendered and a badge that quietly
                  undercounts is worse than a line saying so. */}
              {desk.pendingTruncated ? (
                <p className="nb-hint mt-3">
                  60 shown, which is the page size. If there are more, they
                  come up once you clear these.
                </p>
              ) : null}
            </>
          )}
        </CollapsiblePanel>

        <CollapsiblePanel
          title="The team"
          slug="drawer / the team"
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
