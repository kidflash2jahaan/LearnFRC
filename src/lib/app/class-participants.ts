import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { classesConfigured } from "@/lib/classes/config";
import { deleteParticipant, kickParticipants, type RtkResult } from "@/lib/classes/realtimekit";
import { dropWith, releaseWith, type Drop, type Release } from "@/lib/classes/participant-release";
import type { RtkApp } from "@/lib/classes/types";

/**
 * Letting go of RealtimeKit participants, the one way (the rule is in
 * src/lib/classes/participant-release.ts): delete, else queue the delete in
 * class_rtk_cleanup for the sweep, and forget the id only after one of them
 * worked. Leaving a class, a join that couldn't be saved and account
 * deletion call releaseParticipant. removeFromClass and the webhook's
 * duplicate connections, where the person may be in the call now, call
 * dropParticipant, which also kicks them when the delete fails.
 */

type DeleteParticipantFn = (
  meetingId: string,
  participantId: string,
  opts: { app: RtkApp }
) => Promise<RtkResult<unknown>>;

type KickParticipantsFn = (
  meetingId: string,
  input: { customIds: string[] },
  opts: { app: RtkApp }
) => Promise<RtkResult<unknown>>;

/**
 * Queues a participant for the sweep to delete (drainRtkCleanup in
 * src/lib/classes/reconcile.ts). Until it's deleted, its tokens still work.
 * True when the row is saved.
 */
async function queueParticipantDelete(
  app: RtkApp,
  meetingId: string,
  participantId: string,
  error: string
): Promise<boolean> {
  const { error: saveError } = await createAdminClient()
    .from("class_rtk_cleanup")
    .upsert(
      { rtk_app: app, meeting_id: meetingId, participant_id: participantId, last_error: error.slice(0, 300) || null },
      { onConflict: "meeting_id,participant_id" }
    );
  // The ids go in the log, so one that couldn't be queued isn't lost.
  if (saveError) console.error(`queueParticipantDelete ${app} ${meetingId} ${participantId}:`, saveError.message);
  return !saveError;
}

/** Nulls a row's participant id, only while it's still this one. */
async function forgetParticipant(classId: string, userId: string, participantId: string): Promise<void> {
  const { error } = await createAdminClient()
    .from("class_participants")
    .update({ rtk_participant_id: null })
    .eq("class_id", classId)
    .eq("user_id", userId)
    .eq("rtk_participant_id", participantId);
  if (error) console.error("forgetParticipant:", error.message);
}

/**
 * Deletes a participant at Cloudflare or queues the delete, then has `row`
 * forget it (left out when no row holds the id). Another app's meeting or
 * missing keys fail the delete at once, so those are queued too. Never throws.
 */
export async function releaseParticipant(p: {
  app: RtkApp;
  meetingId: string;
  participantId: string;
  row?: { classId: string; userId: string };
}): Promise<Release> {
  const { app, meetingId, participantId, row } = p;
  return releaseWith({
    del: () => deleteParticipant(meetingId, participantId, { app }),
    queue: (error) => queueParticipantDelete(app, meetingId, participantId, error),
    forget: row ? () => forgetParticipant(row.classId, row.userId, participantId) : undefined,
  });
}

/**
 * For someone who may be in the call now: deletes their participant, else
 * kicks every connection by user id and queues the delete (dropWith). With
 * `keepUntilDeleted` the row keeps the id until a delete works, so their
 * next join deletes it before a new token exists. Without it, the row
 * forgets the id once the delete is queued and the kick worked. Never throws.
 */
export async function dropParticipant(
  p: { app: RtkApp; meetingId: string; participantId: string; classId: string; userId: string; keepUntilDeleted: boolean },
  deps: { deleteParticipant?: DeleteParticipantFn; kickParticipants?: KickParticipantsFn } = {}
): Promise<Drop> {
  const { app, meetingId, participantId, classId, userId } = p;
  const del = deps.deleteParticipant ?? deleteParticipant;
  const kick = deps.kickParticipants ?? kickParticipants;
  return dropWith(
    {
      del: () => del(meetingId, participantId, { app }),
      // no keys: there's nothing to kick with
      kick: classesConfigured() ? () => kick(meetingId, { customIds: [userId] }, { app }) : undefined,
      queue: (error) => queueParticipantDelete(app, meetingId, participantId, error),
      forget: () => forgetParticipant(classId, userId, participantId),
    },
    { keepUntilDeleted: p.keepUntilDeleted }
  );
}
