"use server";

import { createClient } from "@/lib/supabase/server";
import { sendClassChat } from "@/lib/app/class-chat";
import type { ChatBlockedKind, ChatMessage } from "@/lib/classes/types";

/**
 * The website's door onto the class chat (section 6.5). Every rule (who's in
 * the class, the rate limit, the filter, the profanity check, what's stored)
 * is in sendClassChat (src/lib/app/class-chat.ts). Reading the chat doesn't
 * come through here at all: the panel reads class_chat_messages directly,
 * under its members-only read policy.
 */

export type ChatSendState =
  | { ok: true; message: ChatMessage }
  | { ok: false; blocked: true; error: string; kinds: ChatBlockedKind[] }
  | { ok: false; blocked?: false; error: string };

export async function sendClassChatAction(classId: string, text: string): Promise<ChatSendState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sign in again to keep going." };
  const r = await sendClassChat(user, { classId, text });
  if (!r.ok) return { ok: false, error: r.error };
  if (r.status === "blocked") return { ok: false, blocked: true, error: r.note, kinds: r.kinds };
  return { ok: true, message: r.message };
}
