import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getRoomView } from "@/lib/app/classes-room";
import { Room } from "./_room";

/**
 * /classes/[id]/room: LearnFRC's own RealtimeKit room for one class
 * (section 6.5).
 *
 * The server part decides who's looking and what they'd join as, without
 * writing anything (getRoomView in src/lib/app/classes-room.ts): hidden
 * classes are a 404, a signed-out visitor goes to sign in, and anyone the
 * join would refuse sees why before pressing anything. Pressing Join runs
 * every check again in joinClass, which writes the recording-notice record
 * before it makes a token.
 *
 * Everything live (the pre-join notice, the meeting, the chat panel, the
 * media logger, the class controls) is the client part, _room.tsx, which
 * loads the meeting UI only in the browser.
 */

export const metadata: Metadata = {
  // The root template appends " · LearnFRC".
  title: "Class room",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

// A class report from the room takes an evidence hold, whose recording copy
// runs after the response (src/lib/classes/holds.ts).
export const maxDuration = 300;

async function viewer() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user ?? null;
  } catch {
    return null;
  }
}

export default async function ClassRoomPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await viewer();
  const view = await getRoomView(user, id);
  if (view.kind === "hidden" || view.kind === "not_found") notFound();
  if (view.kind === "signed_out") redirect(`/login?next=/classes/${encodeURIComponent(id)}/room`);
  return <Room {...view.room} />;
}
