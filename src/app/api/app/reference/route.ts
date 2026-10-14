import { buildReference } from "@/lib/app/reference";
import { guarded, publicOk } from "@/lib/app/http";

/**
 * GET /api/app/reference: the glossary, learning paths, lesson-to-article
 * links and start goals, built from the same TypeScript modules the site
 * renders (src/lib/app/reference.ts). Public and the same for everyone, so the
 * CDN holds it for an hour. See apple/docs/API.md.
 */
export async function GET() {
  return guarded(async () => publicOk(buildReference(), 3600, 86400));
}
