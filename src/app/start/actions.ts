"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  DEFAULT_GOAL_ID,
  goalById,
  START_GOAL_COOKIE,
  START_GOAL_MAX_AGE,
} from "@/lib/recommend";

/**
 * Record the answer to the one first-run question and send the learner to
 * their plan.
 *
 * The answer lives in a cookie rather than on `profiles` because it needs no
 * migration and no write path on a table this route has no business owning —
 * and because it must work for the whole first session, which is where
 * activation is decided (70% of everyone who ever activated did so within ten
 * minutes of signing up). If the lead later wants it queryable, see the
 * findings: a nullable `profiles.start_goal` column reading from the same
 * `START_GOALS` ids is a drop-in upgrade and this action is the only writer.
 */
export async function chooseGoal(formData: FormData): Promise<void> {
  const goal =
    goalById(String(formData.get("goal") ?? "")) ?? goalById(DEFAULT_GOAL_ID);

  if (goal) {
    const jar = await cookies();
    jar.set(START_GOAL_COOKIE, goal.id, {
      maxAge: START_GOAL_MAX_AGE,
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
  }

  // Outside any try/catch — redirect() signals by throwing.
  redirect("/start");
}
