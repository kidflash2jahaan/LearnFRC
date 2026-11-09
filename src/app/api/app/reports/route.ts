import { fileReport, REPORT_DETAILS_MAX, REPORT_REASONS } from "@/lib/app/reports";
import { ANSWER_WITHIN_HOURS } from "@/lib/app/admin-reports";
import {
  badJson,
  fromFailure,
  guarded,
  ok,
  publicOk,
  readJsonObject,
  requireAppUser,
  successBody,
} from "@/lib/app/http";

// A class report takes an evidence hold, whose recording copy runs after the
// response (src/lib/classes/holds.ts).
export const maxDuration = 300;

/**
 * GET /api/app/reports: the reasons a report can give, in the order the
 * website's report form lists them, with the details limit. Public and the
 * same for everyone, so the CDN keeps it for an hour.
 */
export async function GET() {
  return guarded(async () =>
    publicOk(
      {
        reasons: REPORT_REASONS.map((r) => ({ id: r.id, label: r.label })),
        detailsMax: REPORT_DETAILS_MAX,
        answerWithinHours: ANSWER_WITHIN_HOURS,
      },
      3600
    )
  );
}

/**
 * POST /api/app/reports { username?, contentKind?, contentId?, reason, details?, surface?, platform? }
 *
 * Files a report through fileReport (src/lib/app/reports.ts), the function the
 * website's report form calls: the reasons, the lengths, no reporting
 * yourself, 10 an hour per account, one open report per person per thing, and
 * the email to the owner so it's answered within 24 hours. 201 with
 * `{ reportId, alreadyReported, message }` (200 when it was already reported);
 * `message` is the sentence to show.
 */
export async function POST(req: Request) {
  return guarded(async () => {
    const auth = await requireAppUser(req);
    if (auth instanceof Response) return auth;
    const body = await readJsonObject(req);
    if (!body) return badJson();
    const result = await fileReport(auth.user, {
      username: body.username,
      contentKind: body.contentKind,
      contentId: body.contentId,
      reason: body.reason,
      details: body.details,
      surface: body.surface,
      platform: body.platform,
    });
    if (!result.ok) return fromFailure(result);
    return ok(successBody(result), result.alreadyReported ? 200 : 201);
  });
}
