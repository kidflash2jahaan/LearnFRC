import { buildResourcesPayload } from "@/lib/app/resources";
import { guarded, publicOk } from "@/lib/app/http";

/**
 * GET /api/app/resources: everything learnfrc.com/resources shows, as data.
 * The toolbox shelves and their links, and the sources every department's
 * lessons cite, from loadResources (src/lib/app/resources.ts), the function
 * the page itself renders from. Public and the same for everyone, so the CDN
 * holds it for an hour, like /api/app/reference. See apple/docs/API.md.
 */
export async function GET() {
  return guarded(async () => publicOk(await buildResourcesPayload(), 3600, 86400));
}
