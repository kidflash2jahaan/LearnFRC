"use server";

import { createClient } from "@/lib/supabase/server";
import { sendEmail, subscribeEmailHtml } from "@/lib/email";
import { rateLimit } from "@/lib/rate-limit";

export type SubscribeState = { error?: string; success?: boolean } | undefined;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function subscribe(
  _prev: SubscribeState,
  formData: FormData
): Promise<SubscribeState> {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return { error: "Enter a valid email address." };

  // Throttle by IP and by target email to prevent sign-up email bombing.
  if (
    !(await rateLimit("subscribe", 5, 3600)) ||
    !(await rateLimit("subscribe-email", 2, 86400, email))
  )
    return { error: "Too many requests. Please try again later." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("subscribers")
    .upsert({ email }, { onConflict: "email", ignoreDuplicates: true });
  if (error) return { error: "Couldn't subscribe right now. Try again in a moment." };

  void sendEmail({
    to: email,
    subject: "You're on the LearnFRC list 🤖",
    html: subscribeEmailHtml(),
  });

  return { success: true };
}
