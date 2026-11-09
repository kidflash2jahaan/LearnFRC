"use client";

import * as React from "react";
import { createClient } from "@/lib/supabase/client";
import { sendClassChatAction } from "@/app/actions/class-chat";
import { CHAT_LIMITS } from "@/lib/classes/constants";
import type { ChatMessage, ClassRole } from "@/lib/classes/types";

/**
 * The class chat panel (section 6.5), beside the meeting, for everyone in
 * the class. RealtimeKit's own chat is off, so this is the only chat.
 *
 * Reading: the class's `shown` messages straight from class_chat_messages,
 * under its members-only read policy, with the signed-in session. New ones
 * arrive through Supabase Realtime (postgres_changes on this class); if the
 * channel isn't SUBSCRIBED within 5 seconds, or drops, the panel reads the
 * same table every 4 seconds instead. SUBSCRIBED can come a few seconds
 * before Realtime actually delivers changes, and a row sent in that gap never
 * arrives over it, so every time the channel subscribes (the first time, and
 * again after an error or timeout) the panel reads the table at once, then 3
 * and 8 seconds later. Reads and Realtime rows merge by id, so nothing shows
 * twice and the order stays by id. Neither path touches a Vercel function.
 * Someone removed from the class stops getting messages at once, because the
 * policy stops matching (as does a student who left the class or lost their
 * parent's OK). Messages from accounts the viewer blocked are left out here.
 *
 * Sending: sendClassChatAction, which runs the filter. A blocked message
 * comes back as the note, the text stays in the box so it can be fixed, and
 * nobody else sees anything.
 */

type Row = {
  id: number;
  class_id: string;
  sender_id: string | null;
  sender_username: string;
  sender_role: ClassRole;
  body: string;
  sent_at: string;
  status?: string;
};

const COLS = "id, class_id, sender_id, sender_username, sender_role, body, sent_at";
const KEEP = 300;
/** When to read the table after each SUBSCRIBED, while Realtime's change feed settles. */
const CATCH_UP_MS = [0, 3_000, 8_000];

function toMessage(r: Row): ChatMessage {
  return {
    id: Number(r.id),
    classId: r.class_id,
    senderId: r.sender_id,
    senderUsername: r.sender_username,
    senderRole: r.sender_role,
    body: r.body,
    sentAt: r.sent_at,
  };
}

const TAG: Record<ClassRole, string | null> = {
  teacher: "teacher",
  staff: "LearnFRC staff",
  student: null,
};

export function ChatPanel({
  classId,
  viewerId,
  hiddenSenderIds = [],
}: {
  classId: string;
  viewerId: string;
  /** Accounts the viewer blocked: their messages never show here. */
  hiddenSenderIds?: string[];
}) {
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [mode, setMode] = React.useState<"connecting" | "live" | "polling">("connecting");
  const [text, setText] = React.useState("");
  const [note, setNote] = React.useState<string | null>(null);
  const [sending, setSending] = React.useState(false);
  const listRef = React.useRef<HTMLOListElement>(null);
  const stick = React.useRef(true);
  const uid = React.useId();
  const boxId = `${uid}-box`;
  const noteId = `${uid}-note`;

  // A stable key, so the effect below doesn't resubscribe on every render.
  const hiddenKey = hiddenSenderIds.join(",");
  const merge = React.useCallback(
    (rows: ChatMessage[]) => {
      if (rows.length === 0) return;
      const hidden = new Set(hiddenKey ? hiddenKey.split(",") : []);
      const shown = rows.filter((r) => !r.senderId || !hidden.has(r.senderId));
      if (shown.length === 0) return;
      setMessages((prev) => {
        const byId = new Map(prev.map((m) => [m.id, m]));
        for (const r of shown) byId.set(r.id, r);
        return [...byId.values()].sort((a, b) => a.id - b.id).slice(-KEEP);
      });
    },
    [hiddenKey]
  );

  React.useEffect(() => {
    const supabase = createClient();
    let cancelled = false;
    let subscribed = false;
    let poll: number | null = null;
    let catchUps: number[] = [];
    // The newest id a read of the table has returned. Realtime rows and our
    // own sends don't move it, so a row Realtime missed is still read even
    // when a newer one reached us first.
    let readTo = 0;
    let reading = false;
    let readAgain = false;

    // One read at a time. A read asked for while one is running runs right
    // after it, from where it got to, so it can't miss what landed meanwhile.
    async function load() {
      if (reading) {
        readAgain = true;
        return;
      }
      reading = true;
      try {
        do {
          readAgain = false;
          let q = supabase
            .from("class_chat_messages")
            .select(COLS)
            .eq("class_id", classId)
            .order("id", { ascending: false })
            .limit(200);
          if (readTo > 0) q = q.gt("id", readTo);
          const { data, error } = await q;
          if (cancelled) return;
          if (error) continue;
          const rows = ((data ?? []) as Row[]).map(toMessage);
          for (const r of rows) if (r.id > readTo) readTo = r.id;
          merge(rows);
        } while (readAgain && !cancelled);
      } finally {
        reading = false;
      }
    }

    function stopCatchUps() {
      for (const t of catchUps) window.clearTimeout(t);
      catchUps = [];
    }

    function startPolling() {
      stopCatchUps();
      if (poll !== null || cancelled) return;
      setMode("polling");
      poll = window.setInterval(() => void load(), CHAT_LIMITS.pollEveryMs);
    }

    void load();
    const channel = supabase
      .channel(`class-chat:${classId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "class_chat_messages", filter: `class_id=eq.${classId}` },
        (payload) => {
          const row = payload.new as Row;
          if (row.status && row.status !== "shown") return;
          merge([toMessage(row)]);
        }
      )
      .subscribe((status) => {
        if (cancelled) return;
        if (status === "SUBSCRIBED") {
          subscribed = true;
          if (poll !== null) {
            window.clearInterval(poll);
            poll = null;
          }
          setMode("live");
          // Anything sent while connecting or while the channel was down,
          // then whatever lands before the change feed is really delivering.
          stopCatchUps();
          catchUps = CATCH_UP_MS.map((ms) => window.setTimeout(() => void load(), ms));
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          subscribed = false;
          startPolling();
        }
      });
    const fallback = window.setTimeout(() => {
      if (!subscribed) startPolling();
    }, CHAT_LIMITS.realtimeTimeoutMs);

    return () => {
      cancelled = true;
      window.clearTimeout(fallback);
      stopCatchUps();
      if (poll !== null) window.clearInterval(poll);
      void supabase.removeChannel(channel);
    };
  }, [classId, merge]);

  // Newest at the bottom: follow new messages unless the reader scrolled up.
  React.useEffect(() => {
    const el = listRef.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  async function send() {
    const t = text.trim();
    if (!t || sending) return;
    setSending(true);
    setNote(null);
    try {
      const r = await sendClassChatAction(classId, t);
      if (r.ok) {
        setText("");
        stick.current = true;
        merge([r.message]);
      } else {
        setNote(r.error);
      }
    } catch {
      setNote("Couldn't send that. Try again.");
    } finally {
      setSending(false);
    }
  }

  const left = CHAT_LIMITS.maxChars - text.trim().length;

  return (
    <aside className="nb-box flex min-h-[22rem] flex-col p-3 lg:h-[min(72dvh,46rem)]" aria-labelledby={`${uid}-h`}>
      <div className="flex items-baseline justify-between gap-2">
        <h2 id={`${uid}-h`} className="nb-slug">
          class chat
        </h2>
        <span className="nb-slug text-graphite">
          {mode === "live" ? "live" : mode === "polling" ? "checking every few seconds" : "connecting"}
        </span>
      </div>

      <ol
        ref={listRef}
        role="log"
        aria-live="polite"
        aria-label="Class chat messages"
        onScroll={(e) => {
          const el = e.currentTarget;
          stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
        }}
        className="mt-2 min-h-0 flex-1 overflow-y-auto pr-1"
      >
        {messages.length === 0 ? (
          <li className="nb-hint">No messages yet. Say hi, or ask a question.</li>
        ) : (
          messages.map((m) => (
            <li key={m.id} className="nb-hair py-1.5 first:border-t-0">
              <p className="text-[0.82rem] leading-tight">
                <b className={m.senderId === viewerId ? "text-blue" : undefined}>@{m.senderUsername}</b>
                {TAG[m.senderRole] ? <span className="nb-tag ml-1.5 align-middle">{TAG[m.senderRole]}</span> : null}
              </p>
              <p className="mt-0.5 whitespace-pre-wrap break-words text-[0.95rem] leading-snug">{m.body}</p>
            </li>
          ))
        )}
      </ol>

      <form
        className="mt-2 border-t-2 border-ink pt-2"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <label htmlFor={boxId} className="sr-only">
          Message the class
        </label>
        <textarea
          id={boxId}
          rows={2}
          maxLength={CHAT_LIMITS.maxChars}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            if (note) setNote(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              void send();
            }
          }}
          aria-invalid={note ? true : undefined}
          aria-describedby={note ? noteId : undefined}
          placeholder="Message the class"
          className="nb-input min-h-[3.2rem] w-full"
        />
        <div aria-live="polite">
          {note ? (
            <p id={noteId} className="nb-error mt-1 text-[0.88rem]">
              {note}
            </p>
          ) : null}
        </div>
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="nb-hint">{left < 60 ? `${Math.max(0, left)} left` : "Enter sends"}</span>
          <button type="submit" className="nb-btn nb-btn-sm" disabled={sending || !text.trim()} aria-busy={sending}>
            {sending ? "Sending" : "Send"}
          </button>
        </div>
      </form>
    </aside>
  );
}
