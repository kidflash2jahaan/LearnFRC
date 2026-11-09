#!/usr/bin/env node
// Pushes the three lfrc-* presets and registers the webhook in one RealtimeKit
// app (classes-design.md 6.3, 13.6, 15.4). Idempotent: a second run updates
// in place and changes nothing that's already right.
//
//   node scripts/classes/setup-realtimekit.mjs --app dev [--dev-url https://x.trycloudflare.com]
//   node scripts/classes/setup-realtimekit.mjs --app prod          (release day)
//   node scripts/classes/setup-realtimekit.mjs --app dev --check   (read only: presets match?)
//
// Reads CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_REALTIMEKIT_API_TOKEN and
// CLOUDFLARE_REALTIMEKIT_APP_ID_DEV or _PROD from the worktree's .env.local
// (scripts/classes/make-env.sh). Stores the webhook id under its app in
// class_settings.rtk_webhook_ids, and the organization id when Cloudflare
// reports one, in production's class_settings row. Prints ids, never a key.
//
// The webhook URL: prod is https://learnfrc.com/api/classes/webhook. dev
// needs --dev-url (a quick tunnel into a running `next dev`, section 6.8);
// without it the dev presets are pushed and the webhook is left alone.

import { createClient } from "@supabase/supabase-js";
import { loadEnv, requireEnv } from "./env.mjs";
import { PRESETS, WEBHOOK_EVENTS } from "../../src/lib/classes/presets.ts";

loadEnv();

function arg(name) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const app = arg("--app");
const devUrl = arg("--dev-url");
const checkOnly = process.argv.includes("--check");
if (app !== "dev" && app !== "prod") {
  console.error("usage: setup-realtimekit.mjs --app dev|prod [--dev-url <tunnel url>] [--check]");
  process.exit(2);
}

const appIdName = app === "prod" ? "CLOUDFLARE_REALTIMEKIT_APP_ID_PROD" : "CLOUDFLARE_REALTIMEKIT_APP_ID_DEV";
try {
  requireEnv("CLOUDFLARE_ACCOUNT_ID", "CLOUDFLARE_REALTIMEKIT_API_TOKEN", appIdName);
} catch (e) {
  console.error(`needs keys: ${e.message}`);
  process.exit(3);
}
const BASE = `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/realtime/kit/${process.env[appIdName]}`;

async function rtk(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      Authorization: `Bearer ${process.env.CLOUDFLARE_REALTIMEKIT_API_TOKEN}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15_000),
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    // not JSON
  }
  if (!res.ok || json?.success === false) {
    throw new Error(`${method} ${path}: ${res.status} ${json?.error?.message ?? json?.errors?.[0]?.message ?? text.slice(0, 200)}`);
  }
  return json?.data ?? json?.result ?? json;
}

/** Every leaf in `want` equals the same path in `have`. Returns the mismatches. */
function diff(want, have, path = "") {
  if (want && typeof want === "object" && !Array.isArray(want)) {
    return Object.entries(want).flatMap(([k, v]) => diff(v, have?.[k], path ? `${path}.${k}` : k));
  }
  return JSON.stringify(want) === JSON.stringify(have) ? [] : [`${path}: want ${JSON.stringify(want)}, have ${JSON.stringify(have)}`];
}

const list = (d) => (Array.isArray(d) ? d : (d?.presets ?? d?.webhooks ?? d?.items ?? []));

async function presets() {
  const existing = list(await rtk("GET", "/presets?per_page=100"));
  for (const p of PRESETS) {
    const found = existing.find((x) => x.name === p.name);
    if (checkOnly) {
      if (!found) {
        console.log(`preset ${p.name}: missing`);
        continue;
      }
      const full = await rtk("GET", `/presets/${found.id}`);
      const problems = diff({ config: p.config, permissions: p.permissions }, full);
      console.log(`preset ${p.name}: ${problems.length ? `differs\n  ${problems.join("\n  ")}` : "matches"}`);
      continue;
    }
    const saved = found ? await rtk("PATCH", `/presets/${found.id}`, p) : await rtk("POST", "/presets", p);
    console.log(`preset ${p.name}: ${found ? "updated" : "created"} ${saved?.id ?? found?.id ?? ""}`);
  }
}

async function webhook() {
  const url =
    app === "prod"
      ? "https://learnfrc.com/api/classes/webhook"
      : devUrl
        ? `${devUrl.replace(/\/$/, "")}/api/classes/webhook`
        : null;
  if (!url) {
    console.log("webhook: skipped (dev needs --dev-url)");
    return null;
  }
  const name = `learnfrc-${app}`;
  const hooks = list(await rtk("GET", "/webhooks"));
  const found = hooks.find((h) => h.name === name);
  const body = { name, url, events: [...WEBHOOK_EVENTS], enabled: true };
  if (checkOnly) {
    console.log(`webhook ${name}: ${found ? (found.url === url ? "matches" : `url is ${found.url}`) : "missing"}`);
    return found ?? null;
  }
  const saved = found ? await rtk("PATCH", `/webhooks/${found.id}`, body) : await rtk("POST", "/webhooks", body);
  console.log(`webhook ${name}: ${found ? "updated" : "created"} ${saved?.id ?? found?.id}`);
  return saved ?? found;
}

async function store(hook) {
  if (checkOnly || !hook?.id) return;
  requireEnv("NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY");
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: s, error } = await db.from("class_settings").select("rtk_webhook_ids, rtk_organization_id").eq("id", true).single();
  if (error) throw new Error(`class_settings: ${error.message}`);
  const ids = { ...(s.rtk_webhook_ids ?? {}), [app]: hook.id };
  const org = hook.organization_id ?? hook.organizationId ?? s.rtk_organization_id ?? null;
  const { error: e2 } = await db
    .from("class_settings")
    .update({ rtk_webhook_ids: ids, rtk_organization_id: org, updated_at: new Date().toISOString() })
    .eq("id", true);
  if (e2) throw new Error(`class_settings: ${e2.message}`);
  console.log(`stored webhook id for ${app}${org ? " and the organization id" : ""}`);
}

try {
  await presets();
  await store(await webhook());
} catch (e) {
  console.error(e.message);
  process.exit(1);
}
