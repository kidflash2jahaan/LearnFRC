"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

/**
 * Runs once for a signed-in user: if they have guest completions saved on this
 * device (from learning before they signed up), migrate them into their account
 * and clear the local copy. Mounted on the dashboard, where users land after
 * signing up or logging in.
 */
export function GuestMigration() {
  const router = useRouter();
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    let lessons: Record<string, boolean> = {};
    let visitorId = "";
    try {
      lessons = JSON.parse(localStorage.getItem("lf_guest_lessons") || "{}");
      visitorId = localStorage.getItem("lf_vid") || "";
    } catch {
      return;
    }
    const lessonIds = Object.keys(lessons).filter(Boolean);
    if (!lessonIds.length) return;

    fetch("/api/migrate-guest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lessonIds, visitorId }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((res) => {
        if (!res) return;
        try {
          localStorage.removeItem("lf_guest_lessons");
        } catch {
          /* ignore */
        }
        if (res.migrated > 0) router.refresh();
      })
      .catch(() => {});
  }, [router]);

  return null;
}
