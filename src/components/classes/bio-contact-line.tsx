import Link from "next/link";

/**
 * The warning for a teacher whose profile bio has contact details, which
 * scheduleClass refuses (field "bio"). One wording for /apply/teach and
 * /classes/teaching. The check behind it is hasContactPatterns on the bio
 * (src/lib/classes/contact-patterns.ts), the same one scheduleClass runs.
 */
export function BioContactLine() {
  return (
    <>
      Your profile bio has contact details in it. Take them out on your{" "}
      <Link href="/settings" className="nb-link">
        settings page
      </Link>
      , since everyone in a class can open your profile.
    </>
  );
}
