import Link from "next/link";
import { NOT_CLASS_REVIEWER } from "@/lib/app/class-reviewers";

/**
 * What a signed-in account that isn't a class reviewer sees on the holds and
 * playbook pages. The same card the reports desk uses, with its own reason.
 */
export function ClassReviewLocked({ what }: { what: string }) {
  return (
    <div className="nb-route nb-wrap flex min-h-[60dvh] items-center justify-center py-20">
      <div className="nb-box nb-tilt-2 w-full max-w-lg p-[clamp(1.4rem,4vw,2.4rem)]">
        <span className="nb-tape -top-3 left-[18%] rotate-[-3.2deg]" aria-hidden="true" />
        <p className="nb-slug">access / denied</p>
        <h1 className="mt-3 text-[clamp(1.9rem,1.3rem+2vw,2.8rem)]">This drawer is locked.</h1>
        <p className="mt-4 text-graphite">
          {what} {NOT_CLASS_REVIEWER} Nothing is wrong with your account.
        </p>
        <Link href="/dashboard" className="nb-btn mt-6">
          Back to your dashboard
        </Link>
      </div>
    </div>
  );
}
