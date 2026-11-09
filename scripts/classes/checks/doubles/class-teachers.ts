// Test double for src/lib/app/class-teachers.ts while it's still the
// Foundation's stub (the teachers package builds the real one). getTeacher
// reads the class_teachers row, which is all its signature promises;
// suspendTeacher stays a no-op. Only scripts/classes/checks/pages.check.ts
// loads this, through a resolve hook. Integration drops it with the stub.

import { createAdminClient } from "@/lib/supabase/admin";
import type { ClassTeacherRow, SystemActor } from "@/lib/classes/types";
import type { AppUser, Result } from "@/lib/app/result";

export async function suspendTeacher(
  actor: AppUser | SystemActor,
  input: { userId: string; reason: string }
): Promise<Result> {
  void actor;
  void input;
  return { ok: true };
}

export async function getTeacher(userId: string): Promise<ClassTeacherRow | null> {
  const { data } = await createAdminClient().from("class_teachers").select("*").eq("user_id", userId).maybeSingle();
  return (data as ClassTeacherRow | null) ?? null;
}
