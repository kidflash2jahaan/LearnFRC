/**
 * Letting go of a RealtimeKit participant without losing track of it
 * (sections 6.4 to 6.6). Its join tokens work until it's deleted at
 * Cloudflare, so a class_participants row may forget its id only once the
 * delete went through (a 404 counts: it's gone already) or is queued in
 * class_rtk_cleanup, which the sweep keeps retrying (drainRtkCleanup in
 * reconcile.ts). When neither worked, the row keeps the id.
 *
 * No imports, so node --test runs it (participant-release.test.ts). The
 * server steps are wired up in src/lib/app/class-participants.ts.
 */

export type DeleteResult = { ok: true } | { ok: false; status: number; error: string };

export type ReleaseSteps = {
  /** The delete at Cloudflare. */
  del: () => Promise<DeleteResult>;
  /** Saves the delete for the sweep. True when saved. */
  queue: (error: string) => Promise<boolean>;
  /** Nulls the stored id. Left out when no row holds it. */
  forget?: () => Promise<void>;
};

export type Release = {
  /** kept: neither the delete nor the queue worked, so the id must stay. */
  state: "deleted" | "queued" | "kept";
  /** The failed delete's status and message, "" once deleted. */
  error: string;
};

// delete, else queue; forget after either
export async function releaseWith(steps: ReleaseSteps): Promise<Release> {
  const forget = async () => {
    try {
      await steps.forget?.();
    } catch {
      // the row keeps the id, which is safe
    }
  };
  let res: DeleteResult;
  try {
    res = await steps.del();
  } catch (e) {
    res = { ok: false, status: 0, error: e instanceof Error ? e.message : String(e) };
  }
  if (res.ok || res.status === 404) {
    await forget();
    return { state: "deleted", error: "" };
  }

  const error = `${res.status} ${res.error}`.slice(0, 300);
  let queued = false;
  try {
    queued = await steps.queue(error);
  } catch {
    queued = false;
  }
  if (!queued) return { state: "kept", error };
  await forget();
  return { state: "queued", error };
}
