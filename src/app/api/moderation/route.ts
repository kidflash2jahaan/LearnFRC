import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * Endpoint the scheduled AI moderator calls. It keeps all DB/email credentials
 * on the server: the routine only needs the shared secret + the site URL.
 *
 *  GET  ?secret=CRON_SECRET  -> pending edits + submissions to review (or {disabled:true})
 *  POST ?secret=CRON_SECRET  -> { decisions: [...] } : apply, log, and email ONE digest
 *                               (only if anything was actually acted on)
 */

function authed(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const url = new URL(req.url);
  const provided = url.searchParams.get("secret") || req.headers.get("x-cron-secret");
  return provided === secret;
}

function slugify(s: string): string {
  return (
    s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 80) ||
    "untitled"
  );
}

export async function GET(req: Request) {
  if (!authed(req)) return new NextResponse(null, { status: 401 });
  const admin = createAdminClient();

  const { data: cfg } = await admin
    .from("app_config")
    .select("value")
    .eq("key", "moderation_enabled")
    .maybeSingle();
  if (cfg && cfg.value === false)
    return NextResponse.json({ disabled: true, edits: [], submissions: [] });

  const [{ data: edits }, { data: subs }] = await Promise.all([
    admin
      .from("content_edits")
      .select("id, content_type, lesson_id, article_id, original_content, proposed_content, note")
      .eq("status", "pending")
      .limit(30),
    admin
      .from("content_submissions")
      .select("id, department_id, module_id, new_module_title, title, summary, content, note")
      .eq("status", "pending")
      .limit(30),
  ]);

  // Enrich edits with the lesson/article title; submissions with dept/module names.
  const lessonIds = [...new Set((edits ?? []).map((e) => e.lesson_id).filter(Boolean))] as string[];
  const artIds = [...new Set((edits ?? []).map((e) => e.article_id).filter(Boolean))] as string[];
  const deptIds = [...new Set((subs ?? []).map((s) => s.department_id as string))];
  const modIds = [...new Set((subs ?? []).map((s) => s.module_id).filter(Boolean))] as string[];
  const [lessons, arts, depts, mods] = await Promise.all([
    lessonIds.length
      ? admin.from("lessons").select("id, title").in("id", lessonIds)
      : Promise.resolve({ data: [] as { id: string; title: string }[] }),
    artIds.length
      ? admin.from("articles").select("id, title").in("id", artIds)
      : Promise.resolve({ data: [] as { id: string; title: string }[] }),
    deptIds.length
      ? admin.from("departments").select("id, name").in("id", deptIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    modIds.length
      ? admin.from("modules").select("id, title").in("id", modIds)
      : Promise.resolve({ data: [] as { id: string; title: string }[] }),
  ]);
  const lt = new Map((lessons.data ?? []).map((l) => [l.id, l.title]));
  const at = new Map((arts.data ?? []).map((a) => [a.id, a.title]));
  const dt = new Map((depts.data ?? []).map((d) => [d.id, d.name]));
  const mt = new Map((mods.data ?? []).map((m) => [m.id, m.title]));

  return NextResponse.json({
    edits: (edits ?? []).map((e) => ({
      id: e.id,
      lessonTitle:
        e.content_type === "article"
          ? (at.get(e.article_id as string) ?? "Unknown article")
          : (lt.get(e.lesson_id as string) ?? "Unknown lesson"),
      note: e.note,
      original_content: e.original_content,
      proposed_content: e.proposed_content,
    })),
    submissions: (subs ?? []).map((s) => ({
      id: s.id,
      title: s.title,
      department: dt.get(s.department_id as string) ?? "—",
      module: s.module_id
        ? (mt.get(s.module_id as string) ?? "an existing module")
        : `New module: ${s.new_module_title ?? "Community Lessons"}`,
      summary: s.summary,
      content: s.content,
      note: s.note,
    })),
  });
}

type Decision = {
  kind: "edit" | "submission";
  id: string;
  decision: "approved" | "rejected" | "edited_and_approved";
  corrected_content?: string;
  reason?: string;
  sources?: string[];
};

export async function POST(req: Request) {
  if (!authed(req)) return new NextResponse(null, { status: 401 });
  const admin = createAdminClient();

  let body: { decisions?: Decision[] } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }
  const decisions = Array.isArray(body.decisions) ? body.decisions : [];
  if (!decisions.length) return NextResponse.json({ applied: 0 });

  const done: { kind: string; title: string; decision: string; reason: string }[] = [];

  for (const d of decisions) {
    try {
      if (d.kind === "edit") {
        const { data: edit } = await admin
          .from("content_edits")
          .select("id, content_type, lesson_id, article_id, proposed_content, status")
          .eq("id", d.id)
          .maybeSingle();
        if (!edit || edit.status !== "pending") continue;
        const isArticle = edit.content_type === "article";
        const targetTable = isArticle ? "articles" : "lessons";
        const targetId = (isArticle ? edit.article_id : edit.lesson_id) as string;
        const { data: target } = await admin
          .from(targetTable)
          .select("title")
          .eq("id", targetId)
          .maybeSingle();
        const title = (target?.title as string) ?? (isArticle ? "article" : "lesson");
        if (d.decision === "approved" || d.decision === "edited_and_approved") {
          const content =
            d.decision === "edited_and_approved" && d.corrected_content
              ? d.corrected_content
              : (edit.proposed_content as string);
          await admin.from(targetTable).update({ content }).eq("id", targetId);
        }
        await admin
          .from("content_edits")
          .update({ status: d.decision === "rejected" ? "rejected" : "accepted", reviewed_at: new Date().toISOString() })
          .eq("id", d.id);
        await admin.from("moderation_log").insert({
          kind: "edit",
          ref_id: d.id,
          title,
          decision: d.decision,
          reason: d.reason ?? null,
          sources: d.sources ?? [],
        });
        done.push({ kind: "edit", title, decision: d.decision, reason: d.reason ?? "" });
      } else if (d.kind === "submission") {
        const { data: sub } = await admin
          .from("content_submissions")
          .select("*")
          .eq("id", d.id)
          .maybeSingle();
        if (!sub || sub.status !== "pending") continue;
        const title = sub.title as string;
        let createdLessonId: string | null = null;

        if (d.decision === "approved" || d.decision === "edited_and_approved") {
          // resolve module
          let moduleId = sub.module_id as string | null;
          if (!moduleId) {
            const modTitle = (sub.new_module_title as string) || "Community Lessons";
            const { data: maxMod } = await admin
              .from("modules")
              .select("sort_order")
              .eq("department_id", sub.department_id as string)
              .order("sort_order", { ascending: false })
              .limit(1)
              .maybeSingle();
            let base = slugify(modTitle);
            let slug = base;
            for (let i = 2; ; i++) {
              const { data: clash } = await admin
                .from("modules")
                .select("id")
                .eq("department_id", sub.department_id as string)
                .eq("slug", slug)
                .maybeSingle();
              if (!clash) break;
              slug = `${base}-${i}`;
            }
            const { data: mod } = await admin
              .from("modules")
              .insert({
                department_id: sub.department_id as string,
                title: modTitle,
                slug,
                sort_order: ((maxMod?.sort_order as number) ?? 0) + 1,
              })
              .select("id")
              .single();
            moduleId = mod!.id as string;
          }
          const { data: maxLes } = await admin
            .from("lessons")
            .select("sort_order")
            .eq("module_id", moduleId)
            .order("sort_order", { ascending: false })
            .limit(1)
            .maybeSingle();
          let base = slugify(title);
          let slug = base;
          for (let i = 2; ; i++) {
            const { data: clash } = await admin
              .from("lessons")
              .select("id")
              .eq("module_id", moduleId)
              .eq("slug", slug)
              .maybeSingle();
            if (!clash) break;
            slug = `${base}-${i}`;
          }
          const content =
            d.decision === "edited_and_approved" && d.corrected_content
              ? d.corrected_content
              : (sub.content as string);
          const words = content.split(/\s+/).length;
          const { data: les } = await admin
            .from("lessons")
            .insert({
              module_id: moduleId,
              slug,
              title,
              summary: (sub.summary as string) ?? null,
              content,
              estimated_minutes: Math.max(1, Math.round(words / 200)),
              sort_order: ((maxLes?.sort_order as number) ?? 0) + 1,
            })
            .select("id")
            .single();
          createdLessonId = les!.id as string;
        }
        await admin
          .from("content_submissions")
          .update({
            status: d.decision === "rejected" ? "rejected" : "accepted",
            reviewed_at: new Date().toISOString(),
            created_lesson_id: createdLessonId,
          })
          .eq("id", d.id);
        await admin.from("moderation_log").insert({
          kind: "submission",
          ref_id: d.id,
          title,
          decision: d.decision,
          reason: d.reason ?? null,
          sources: d.sources ?? [],
        });
        done.push({ kind: "submission", title, decision: d.decision, reason: d.reason ?? "" });
      }
    } catch {
      /* skip a bad decision, keep going */
    }
  }

  // Revalidate cached content if anything was published, so it goes live.
  if (done.some((x) => x.decision !== "rejected")) revalidateTag("catalog", "max");

  // No email here — the scheduled routine folds `done` into one combined digest.
  return NextResponse.json({ applied: done.length, done });
}
