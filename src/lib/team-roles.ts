/**
 * The reader's role on their own FRC team, as a word instead of a slug.
 *
 * `profiles.role` stores `student` / `mentor` / `alum` / `coach` / `other`, and
 * three separate surfaces print that value at a person: the record strip on
 * /apply, the review desk on /admin/team, and the owner's notification email.
 * Printed raw, one applicant in five arrives as "other", which is not a thing
 * anybody says about themselves and tells the reviewer nothing.
 *
 * Lowercase on purpose. All three places set this inside a mono stamp line
 * beside "not given" and "no username yet", and a capitalised word in that row
 * reads as a different kind of thing. /settings prints its own title-case
 * version in a different register, which is the only other copy of this table.
 *
 * Plain module, no `server-only`: the apply page hands the label to a client
 * island, and the team desk and the email read it on the server.
 */
export const TEAM_ROLE_LABELS: Record<string, string> = {
  student: "student",
  mentor: "mentor",
  alum: "alum",
  coach: "coach",
  other: "team member",
};

/**
 * The word for a stored role. An unknown slug is passed through rather than
 * hidden, because a value the table has not caught up with is still true.
 */
export function teamRoleLabel(
  role: string | null | undefined,
  fallback = "not given"
): string {
  if (!role) return fallback;
  return TEAM_ROLE_LABELS[role] ?? role;
}
