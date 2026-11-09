// Test double for src/lib/app/class-teachers.ts, used only by
// room-and-chat.check.ts while that file is still the Foundation's stub.
//
// getTeacher reads the class_teachers row (the stub returns null, which
// would refuse every teacher's join). suspendTeacher is the real stub, so the
// check can see it was called ("[stub] suspendTeacher") and leave its effect
// to integration, as the design says.

import { createAdminClient } from "../../../../src/lib/supabase/admin.ts";
import type { ClassTeacherRow } from "../../../../src/lib/classes/types.ts";

export { suspendTeacher } from "../../../../src/lib/app/class-teachers.ts";

export async function getTeacher(userId: string): Promise<ClassTeacherRow | null> {
  const { data } = await createAdminClient().from("class_teachers").select("*").eq("user_id", userId).maybeSingle();
  return (data as ClassTeacherRow | null) ?? null;
}
