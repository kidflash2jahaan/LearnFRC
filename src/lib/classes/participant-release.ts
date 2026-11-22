/**
 * Letting go of a RealtimeKit participant without losing track of it
 * (sections 6.4 to 6.6). Its join tokens work until it's deleted at
 * Cloudflare, so a class_participants row may forget its id only once the
 * delete went through (a 404 counts: it's gone already) or is queued in
 * class_rtk_cleanup, which the sweep keeps retrying (drainRtkCleanup in
 * reconcile.ts). When neither worked, the row keeps the id.
 *
 * Someone who may be in the call now (a removal, a duplicate connection)
 * is also kicked when the delete fails, so they're out at once (dropWith).
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

export type DropSteps = ReleaseSteps & {
  /** Kicks every connection by our user id. Left out when there's no call to make (no keys). */
  kick?: () => Promise<DeleteResult>;
};

export type Drop = {
  /**
   * deleted: gone, every token with it. kicked: out of the call, but the
   * token works until a delete goes through. skipped: no kick to try.
   * failed: the kick failed too.
   */
  video: "deleted" | "kicked" | "skipped" | "failed";
  /** The delete is saved in class_rtk_cleanup for the sweep. */
  queued: boolean;
  /** The failed delete's status and message, "" once deleted. */
  error: string;
};

// a 404 means it's gone already
const gone = (r: DeleteResult) => r.ok || r.status === 404;

// runs a call; a throw counts as a failure
async function attempt(call: () => Promise<DeleteResult>): Promise<DeleteResult> {
  try {
    return await call();
  } catch (e) {
    return { ok: false, status: 0, error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Delete, else kick and queue. The row forgets the id once it's deleted.
 * After a failed delete it forgets only when the delete is queued and the
 * kick didn't fail, and never with `keepUntilDeleted`: then the next join
 * (joinClass deletes the old participant first), Remove or duplicate check
 * tries the delete again.
 */
export async function dropWith(steps: DropSteps, opts: { keepUntilDeleted: boolean }): Promise<Drop> {
  const forget = async () => {
    try {
      await steps.forget?.();
    } catch {
      // the row keeps the id, which is safe
    }
  };
  const res = await attempt(steps.del);
  if (res.ok || res.status === 404) {
    await forget();
    return { video: "deleted", queued: false, error: "" };
  }

  const error = `${res.status} ${res.error}`.slice(0, 300);
  let video: Drop["video"] = "skipped";
  if (steps.kick) video = gone(await attempt(steps.kick)) ? "kicked" : "failed";
  let queued = false;
  try {
    queued = await steps.queue(error);
  } catch {
    queued = false;
  }
  if (queued && video !== "failed" && !opts.keepUntilDeleted) await forget();
  return { video, queued, error };
}

// delete, else queue; forget after either
export async function releaseWith(steps: ReleaseSteps): Promise<Release> {
  const d = await dropWith(steps, { keepUntilDeleted: false });
  return { state: d.video === "deleted" ? "deleted" : d.queued ? "queued" : "kept", error: d.error };
}
