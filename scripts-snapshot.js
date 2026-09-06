#!/usr/bin/env node
/**
 * Writes a dated, permanent record of LearnFRC's numbers.
 *
 * WHY THIS EXISTS. Vercel Web Analytics on the Pro plan only serves the latest
 * 366 days: querying past that returns "the pro plan only grants access to the
 * latest 366 days". So every traffic figure is a ROLLING window, not a total.
 * June 2026's traffic stops being retrievable around July 2027, and the "all
 * time" number quietly starts falling. A figure cited somewhere permanent, an
 * application or a resume, has to be captured while it is still answerable.
 *
 * Supabase figures do not expire: that is our own database.
 *
 * Run: node scripts-snapshot.js
 */
const fs = require("fs");
const path = require("path");
const ROOT = __dirname;

const env = fs.readFileSync(path.join(ROOT, ".env.local"), "utf8");
const g = (k) => { const m = env.match(new RegExp("^" + k + "=(.*)$", "m")); return m ? m[1].trim() : null; };
const U = g("NEXT_PUBLIC_SUPABASE_URL"), K = g("SUPABASE_SERVICE_ROLE_KEY");
const T = g("VERCEL_ANALYTICS_TOKEN"), P = g("VERCEL_PROJECT_ID"), TE = g("VERCEL_TEAM_ID");
const H = { apikey: K, Authorization: "Bearer " + K };

const count = async (table, q = "") => {
  const r = await fetch(`${U}/rest/v1/${table}?select=id${q ? "&" + q : ""}`,
    { headers: { ...H, Prefer: "count=exact", Range: "0-0" } });
  return +(r.headers.get("content-range") || "/0").split("/")[1];
};
const vercel = async (since, until, filter) => {
  const p = new URLSearchParams({ projectId: P, teamId: TE, since, until, ...(filter ? { filter } : {}) });
  const r = await fetch(`https://api.vercel.com/v1/query/web-analytics/visits/count?${p}`,
    { headers: { Authorization: "Bearer " + T } });
  const j = await r.json();
  return j.data || { visitors: null, pageviews: null };
};
const months = async (since, until) => {
  const p = new URLSearchParams({ projectId: P, teamId: TE, since, until, by: "month", limit: "40" });
  const r = await fetch(`https://api.vercel.com/v1/query/web-analytics/visits/aggregate?${p}`,
    { headers: { Authorization: "Bearer " + T } });
  return ((await r.json()).data || []).filter((m) => m.pageviews > 0);
};

(async () => {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const since = new Date(now.getTime() - 365 * 864e5).toISOString().slice(0, 10);

  const traffic = await vercel(since, today);
  const by = await months(since, today);
  const db = {
    accounts: await count("profiles"),
    lessonsPublished: await count("lessons"),
    departments: await count("departments"),
    articles: await count("articles"),
    lessonCompletions: await count("lesson_progress", "completed_at=not.is.null"),
    achievementsEarned: await count("user_achievements"),
    bookmarks: await count("bookmarks"),
  };
  const teamRows = await (await fetch(`${U}/rest/v1/profiles?select=team_number&team_number=not.is.null`, { headers: H })).json();
  db.distinctFrcTeams = new Set(teamRows.map((t) => t.team_number)).size;

  const snap = { capturedAt: now.toISOString(), window: { since, until: today }, traffic, byMonth: by, database: db };
  const jsonPath = path.join(ROOT, "docs/snapshots", `${today}.json`);
  fs.writeFileSync(jsonPath, JSON.stringify(snap, null, 2));

  const md = `# LearnFRC numbers, captured ${today}

Traffic is a ROLLING 366-day window on Vercel's Pro plan, so these figures stop
being retrievable as they age. That is why this file exists. Database figures
below never expire.

## Traffic, Vercel Web Analytics, ${since} to ${today}

- ${traffic.visitors.toLocaleString()} unique visitors
- ${traffic.pageviews.toLocaleString()} page views

By month, so a shrinking total can always be reconstructed:

| month | visitors | page views |
|---|---|---|
${by.map((m) => `| ${String(m.timestamp).slice(0, 7)} | ${m.visitors.toLocaleString()} | ${m.pageviews.toLocaleString()} |`).join("\n")}

## The site itself, Supabase, permanent

- ${db.accounts.toLocaleString()} accounts
- ${db.lessonCompletions.toLocaleString()} lesson completions
- ${db.lessonsPublished} lessons across ${db.departments} departments
- ${db.articles} articles
- ${db.distinctFrcTeams} distinct FRC teams represented
- ${db.achievementsEarned.toLocaleString()} achievements earned

Raw data: docs/snapshots/${today}.json
`;
  fs.writeFileSync(path.join(ROOT, "docs/snapshots", `${today}.md`), md);
  console.log(md);
  console.log(`written: docs/snapshots/${today}.md and .json`);
})();
