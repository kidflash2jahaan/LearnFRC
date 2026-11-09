"use server";

import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { approveHoursLetter, declineHoursLetter, revokeHoursLetter } from "@/lib/classes/letters";
import { NOT_CLASS_REVIEWER } from "@/lib/app/class-reviewers";

/**
 * The signing desk's door: approve and sign, decline, withdraw. Each shared
 * function checks the caller is a class reviewer (a super admin or the safety
 * lead) itself, so these only read the verified session and the form.
 */

export type LetterDeskState =
  | {
      error?: string;
      field?: "reason";
      message?: string;
    }
  | undefined;

function field(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}

export async function answerLetterAction(_prev: LetterDeskState, formData: FormData): Promise<LetterDeskState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: NOT_CLASS_REVIEWER };

  const id = field(formData, "id");
  const action = field(formData, "action");
  const reason = field(formData, "reason");

  if (action === "approve") {
    const r = await approveHoursLetter(user, { id });
    if (!r.ok) return { error: r.error };
    refresh();
    return { message: `Signed. The code is ${r.code}, and the teacher's email is on its way.` };
  }
  if (action === "decline") {
    const r = await declineHoursLetter(user, { id, reason });
    if (!r.ok) return r.field === "reason" ? { error: r.error, field: "reason" } : { error: r.error };
    refresh();
    return { message: "Declined. The teacher gets the reason by email." };
  }
  if (action === "revoke") {
    const r = await revokeHoursLetter(user, { id, reason });
    if (!r.ok) return r.field === "reason" ? { error: r.error, field: "reason" } : { error: r.error };
    refresh();
    return { message: "Withdrawn. The verify page says so now, and the teacher gets an email." };
  }
  return { error: "That isn't something this page can do." };
}
