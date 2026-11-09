"use client";

import * as React from "react";

/**
 * The transcript and the chat, collapsible and searchable (classes-design.md
 * 7.6). Chat messages the filter stopped show in place, marked. Each line has
 * an id (`t-<seconds>`) so a flag's timestamp can jump to it.
 */

type Line = { atSeconds: number; clock: string; label: string; role: string | null; text: string };
type Chat = { id: number; atSeconds: number; clock: string; username: string; role: string; status: "shown" | "blocked"; kinds: string[]; body: string };

const ROLE_TAG: Record<string, string> = { teacher: " (teacher)", staff: " (staff)" };

export function ClassRecord({ transcript, chat }: { transcript: Line[]; chat: Chat[] }) {
  const [q, setQ] = React.useState("");
  const uid = React.useId();
  const needle = q.trim().toLowerCase();
  const lines = needle ? transcript.filter((l) => `${l.label} ${l.text}`.toLowerCase().includes(needle)) : transcript;
  const msgs = needle ? chat.filter((m) => `@${m.username} ${m.body}`.toLowerCase().includes(needle)) : chat;
  const blocked = chat.filter((m) => m.status === "blocked").length;

  return (
    <div className="max-w-[62rem]">
      <div className="nb-field max-w-md">
        <label className="nb-label" htmlFor={`${uid}-q`}>
          Search the transcript and chat
        </label>
        <input id={`${uid}-q`} type="search" value={q} onChange={(e) => setQ(e.target.value)} className="nb-input" />
      </div>

      <details open className="mt-6">
        <summary className="cursor-pointer text-[1.1rem] font-bold">
          Transcript ({needle ? `${lines.length} of ${transcript.length}` : transcript.length} lines)
        </summary>
        {transcript.length === 0 ? (
          <p className="nb-hint mt-3">No transcript is stored for this class.</p>
        ) : (
          <ol className="mt-3 max-h-[36rem] overflow-y-auto border-2 border-ink bg-card p-3">
            {lines.map((l, i) => (
              <li key={`${l.atSeconds}-${i}`} id={`t-${Math.floor(l.atSeconds)}`} className="py-1 text-[0.93rem] leading-snug">
                <span className="nb-slug mr-2 tabular-nums">{l.clock}</span>
                <b>
                  {l.label}
                  {l.role ? (ROLE_TAG[l.role] ?? "") : ""}:
                </b>{" "}
                <span className="break-words">{l.text}</span>
              </li>
            ))}
          </ol>
        )}
      </details>

      <details open className="mt-6">
        <summary className="cursor-pointer text-[1.1rem] font-bold">
          Chat ({chat.length} messages{blocked ? `, ${blocked} stopped by the filter` : ""})
        </summary>
        {chat.length === 0 ? (
          <p className="nb-hint mt-3">Nobody used the chat.</p>
        ) : (
          <ol className="mt-3 max-h-[28rem] overflow-y-auto border-2 border-ink bg-card p-3">
            {msgs.map((m) => (
              <li key={m.id} className="py-1 text-[0.93rem] leading-snug">
                <span className="nb-slug mr-2 tabular-nums">{m.clock}</span>
                <b>
                  @{m.username}
                  {ROLE_TAG[m.role] ?? ""}:
                </b>{" "}
                <span className={m.status === "blocked" ? "break-words line-through decoration-2" : "break-words"}>{m.body}</span>
                {m.status === "blocked" ? (
                  <span className="nb-tag ml-2">stopped by the filter: {m.kinds.join(", ").replace(/_/g, " ") || "link"}</span>
                ) : null}
              </li>
            ))}
          </ol>
        )}
      </details>
    </div>
  );
}
