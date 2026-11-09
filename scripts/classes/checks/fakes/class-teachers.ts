// Test stand-in for src/lib/app/class-teachers.ts (the teachers package),
// loaded only by letters.check.ts in place of the Foundation's stub, whose
// getTeacher returns null until integration. Same signatures; getTeacher
// reads the class_teachers row the way the real one will. Every call is
// recorded, so the check can see the letters code went through it.

import { createAdminClient } from "@/lib/supabase/admin";
import type { ClassTeacherRow, SystemActor } from "@/lib/classes/types";
import type { AppUser, Result } from "@/lib/app/result";

type Calls = { name: string; arg: unknown }[];
const g = globalThis as unknown as { __lettersFakeCalls?: Calls };
const calls: Calls = (g.__lettersFakeCalls ??= []);

export async function suspendTeacher(
  actor: AppUser | SystemActor,
  input: { userId: string; reason: string }
): Promise<Result> {
  calls.push({ name: "suspendTeacher", arg: { userId: input.userId, system: "system" in actor } });
  return { ok: true };
}

export async function getTeacher(userId: string): Promise<ClassTeacherRow | null> {
  calls.push({ name: "getTeacher", arg: userId });
  const { data } = await createAdminClient().from("class_teachers").select("*").eq("user_id", userId).maybeSingle();
  return (data as ClassTeacherRow | null) ?? null;
}
