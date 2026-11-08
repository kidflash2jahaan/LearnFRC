import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { UnblockButton } from "@/components/safety/block-button";
import type { BlockedAccount } from "@/lib/app/blocks";

/**
 * Everyone this member has blocked, with a way to undo each one. Drawn as its
 * own card like the motion and email cards beside it. The list comes from
 * listBlocks (src/lib/app/blocks.ts), the same function the app's Settings
 * reads through GET /api/app/blocks, so both list the same people.
 */
export function BlockedAccountsCard({ blocks }: { blocks: BlockedAccount[] }) {
  const shown = blocks.filter((b): b is BlockedAccount & { username: string } => !!b.username);
  return (
    <section className="nb-box p-[var(--pad)]" aria-labelledby="blocked-h">
      <p className="nb-slug">settings / blocked</p>
      <h3 id="blocked-h" className="mt-2">
        Blocked accounts
      </h3>
      <p className="nb-sub mt-2">
        People you block are hidden from you: their profile, their rows on the
        leaderboards, their row on your team sheet and their suggestions on the{" "}
        <Link href="/contributions" className="nb-link">
          change log
        </Link>
        . They aren&rsquo;t told, and you can unblock them here any time.
      </p>

      {shown.length === 0 ? (
        <p className="nb-hair nb-hint mt-5 pt-4">
          You haven&rsquo;t blocked anyone. To block someone, open their profile
          and use the button at the bottom.
        </p>
      ) : (
        <ul className="nb-hair mt-5 pt-1">
          {shown.map((b) => (
            <li
              key={b.username}
              className="flex flex-wrap items-center justify-between gap-3 border-b border-dashed border-rule py-3 last:border-b-0"
            >
              <span className="flex min-w-0 items-center gap-3">
                <Avatar
                  name={b.username}
                  src={b.avatarUrl}
                  seed={b.username}
                  className="h-9 w-9 text-[0.7rem]"
                />
                <span className="min-w-0">
                  <span className="block truncate font-bold">@{b.username}</span>
                  {b.blockedAt ? (
                    <span className="nb-slug block">
                      blocked{" "}
                      {new Date(b.blockedAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                  ) : null}
                </span>
              </span>
              <UnblockButton username={b.username} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
