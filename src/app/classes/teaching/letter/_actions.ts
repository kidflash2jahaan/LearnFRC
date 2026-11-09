"use server";

import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requestHoursLetter } from "@/lib/classes/letters";
import { hoursAndMinutes } from "@/lib/classes/letter-rules";
import { COORDINATOR } from "@/lib/classes/coordinator";

/**
 * The teacher's door onto hours letters. Every rule (who can ask, the date
 * range, which classes count, the open and daily limits, the locked name)
 * lives in src/lib/classes/letters.ts. A "use server" function is a public
 * endpoint, so it reads the verified session itself and takes nothing else
 * from the form but the two dates: there's no name field to send.
 */

export type LetterRequestState =
  | {
      error?: string;
      field?: "start" | "end";
      message?: string;
    }
  | undefined;

export async function requestLetterAction(
  _prev: LetterRequestState,
  formData: FormData
): Promise<LetterRequestState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in first, then ask again." };

  const result = await requestHoursLetter(user, {
    start: String(formData.get("start") ?? "").trim(),
    end: String(formData.get("end") ?? "").trim(),
  });
  if (!result.ok) {
    const field = result.field === "start" || result.field === "end" ? result.field : undefined;
    return field ? { error: result.error, field } : { error: result.error };
  }
  refresh();
  return {
    message: `Sent to ${COORDINATOR.name}: ${result.classCount} ${result.classCount === 1 ? "class" : "classes"}, ${hoursAndMinutes(result.totalMinutes)}. You'll get an email when it's signed.`,
  };
}
