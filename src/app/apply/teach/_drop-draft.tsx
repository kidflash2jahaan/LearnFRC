"use client";

import * as React from "react";
import { dropTeachDraft } from "@/lib/classes/teach-draft";

/**
 * Deletes this account's teacher draft on a device where the form isn't
 * shown any more: the application was sent (maybe from another device), they
 * already teach, or they can't apply. Renders nothing.
 */
export function DropTeachDraft({ userId }: { userId: string }) {
  React.useEffect(() => {
    dropTeachDraft(userId);
  }, [userId]);
  return null;
}
