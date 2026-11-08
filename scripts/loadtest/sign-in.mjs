#!/usr/bin/env node
/**
 * A gentle sign-in load test for a LearnFRC preview deployment.
 *
 * Signs one throwaway account in, over and over, at a fixed and deliberately
 * slow rate, and reports how long each sign-in took and how many failed.
 * Read README.md in this folder before running it. Nothing here runs on its
 * own: no cron, no CI, no npm script.
 *
 *   LOADTEST_URL=https://learnfrc-git-release-10-xyz.vercel.app \
 *   LOADTEST_IDENTIFIER=loadtest_1208 \
 *   LOADTEST_PASSWORD='...' \
 *   node scripts/loadtest/sign-in.mjs --per-minute 1.5 --minutes 10
 *
 * Node 18 or newer (global fetch). No dependencies.
 */

import { parseArgs } from "node:util";

/** Hosts that serve production. This script never sends to them. */
const PRODUCTION_HOSTS = new Set([
  "learnfrc.com",
  "www.learnfrc.com",
  "learnfrc.systemerr.com",
  "www.learnfrc.systemerr.com",
  "learnfrc.vercel.app",
]);

/** The ceiling on --per-minute. Past this it stops being gentle. */
const MAX_PER_MINUTE = 60;
/** The ceiling on --minutes. */
const MAX_MINUTES = 60;
/** Stop after this many server errors or network failures in a row. */
const MAX_CONSECUTIVE_FAILURES = 5;
/** Give up on one request after this long. */
const REQUEST_TIMEOUT_MS = 15_000;

const HELP = `Usage: node scripts/loadtest/sign-in.mjs [options]

Environment:
  LOADTEST_URL          Preview deployment base URL (or --url)
  LOADTEST_IDENTIFIER   Throwaway account's email or username
  LOADTEST_PASSWORD     Throwaway account's password
  VERCEL_AUTOMATION_BYPASS_SECRET
                        Optional. Sent as x-vercel-protection-bypass when the
                        preview is behind Vercel Deployment Protection.

Options:
  --url <url>             Base URL, overrides LOADTEST_URL
  --per-minute <n>        Sign-ins per minute (default 1.5, max ${MAX_PER_MINUTE})
  --minutes <n>           How long to run (default 10, max ${MAX_MINUTES})
  --max-in-flight <n>     Most requests waiting at once (default 4)
  --no-backoff            Keep sending through a 429 instead of pausing
  --dry-run               Print the plan and exit without sending anything
  -h, --help              Show this help
`;

function fail(message) {
  console.error(`sign-in load test: ${message}`);
  process.exit(1);
}

function positiveNumber(raw, name, max) {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) fail(`${name} must be a positive number.`);
  if (n > max) fail(`${name} can't be more than ${max}. This test is meant to be gentle.`);
  return n;
}

const { values } = parseArgs({
  options: {
    url: { type: "string" },
    "per-minute": { type: "string", default: "1.5" },
    minutes: { type: "string", default: "10" },
    "max-in-flight": { type: "string", default: "4" },
    "no-backoff": { type: "boolean", default: false },
    "dry-run": { type: "boolean", default: false },
    help: { type: "boolean", short: "h", default: false },
  },
});

if (values.help) {
  console.log(HELP);
  process.exit(0);
}

/* ── configuration ─────────────────────────────────────────────────────── */

const rawUrl = values.url || process.env.LOADTEST_URL;
if (!rawUrl) fail("set LOADTEST_URL or pass --url with the preview deployment's address.");

let base;
try {
  base = new URL(rawUrl);
} catch {
  fail(`"${rawUrl}" isn't a URL.`);
}
const host = base.hostname.toLowerCase();
const isLocal = host === "localhost" || host === "127.0.0.1" || host === "[::1]";
if (PRODUCTION_HOSTS.has(host)) {
  fail(`${host} is production. Point this at a preview deployment instead.`);
}
if (base.protocol !== "https:" && !isLocal) {
  fail("use the https:// address of the preview.");
}

const identifier = process.env.LOADTEST_IDENTIFIER?.trim();
const password = process.env.LOADTEST_PASSWORD;
if (!identifier || !password) {
  fail("set LOADTEST_IDENTIFIER and LOADTEST_PASSWORD for the throwaway account (environment only, never flags).");
}

const perMinute = positiveNumber(values["per-minute"], "--per-minute", MAX_PER_MINUTE);
const minutes = positiveNumber(values.minutes, "--minutes", MAX_MINUTES);
const maxInFlight = Math.floor(positiveNumber(values["max-in-flight"], "--max-in-flight", 20));
const backoff = !values["no-backoff"];

const endpoint = new URL("/api/app/auth/sign-in", base).toString();
const intervalMs = 60_000 / perMinute;
const total = Math.max(1, Math.floor(perMinute * minutes));

const headers = {
  "Content-Type": "application/json",
  "User-Agent": "learnfrc-loadtest/1 (sign-in)",
};
if (process.env.VERCEL_AUTOMATION_BYPASS_SECRET) {
  headers["x-vercel-protection-bypass"] = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
}

console.log(
  [
    `target     ${endpoint}`,
    `account    ${identifier}`,
    `rate       ${perMinute} per minute (one every ${(intervalMs / 1000).toFixed(1)} s)`,
    `duration   ${minutes} min, ${total} sign-ins`,
    `in flight  at most ${maxInFlight}`,
    `on 429     ${backoff ? "pause until Retry-After" : "keep sending"}`,
  ].join("\n")
);

if (values["dry-run"]) {
  console.log("\nDry run: nothing sent.");
  process.exit(0);
}

/* ── the run ───────────────────────────────────────────────────────────── */

/** One row per finished request. */
const results = [];
let inFlight = 0;
let consecutiveFailures = 0;
let pausedUntil = 0;
let stopping = false;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const stamp = () => new Date().toISOString().slice(11, 19);

async function signInOnce(n) {
  const started = performance.now();
  let status = 0;
  let code = "";
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({ identifier, password }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    status = res.status;
    // Read the body so the connection is released, but keep only the error
    // code. A 200 carries the session tokens, which never get printed.
    const body = await res.json().catch(() => null);
    code = res.ok ? "ok" : String(body?.code ?? "unknown");
    if (status === 429 && backoff) {
      const retry = Number(res.headers.get("retry-after")) || 60;
      pausedUntil = Math.max(pausedUntil, Date.now() + Math.min(retry, 600) * 1000);
    }
  } catch (e) {
    code = e?.name === "TimeoutError" ? "timeout" : "network";
  }
  const ms = Math.round(performance.now() - started);
  results.push({ n, status, code, ms });

  const serverTrouble = status === 0 || status >= 500;
  consecutiveFailures = serverTrouble ? consecutiveFailures + 1 : 0;
  console.log(`${stamp()}  #${String(n).padStart(3)}  ${String(status || "---").padStart(3)}  ${String(ms).padStart(6)} ms  ${code}`);
  if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
    console.error(`\nStopping: ${MAX_CONSECUTIVE_FAILURES} server errors or network failures in a row.`);
    stopping = true;
  }
}

function percentile(sorted, p) {
  if (sorted.length === 0) return 0;
  const i = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, i)];
}

function summarize() {
  const byCode = {};
  for (const r of results) byCode[`${r.status || "---"} ${r.code}`] = (byCode[`${r.status || "---"} ${r.code}`] ?? 0) + 1;
  const okTimes = results.filter((r) => r.status === 200).map((r) => r.ms).sort((a, b) => a - b);
  console.log("\nSummary");
  console.log(`  sent        ${results.length} of ${total}`);
  for (const [k, v] of Object.entries(byCode).sort()) console.log(`  ${k.padEnd(24)}${v}`);
  if (okTimes.length) {
    console.log(
      `  200 latency p50 ${percentile(okTimes, 50)} ms, p90 ${percentile(okTimes, 90)} ms, p99 ${percentile(okTimes, 99)} ms, max ${okTimes[okTimes.length - 1]} ms`
    );
  }
}

process.on("SIGINT", () => {
  if (stopping) process.exit(130);
  console.log("\nStopping after the requests already in flight. Ctrl-C again to quit now.");
  stopping = true;
});

const pending = [];
let t0 = Date.now();
for (let n = 1; n <= total && !stopping; n++) {
  // Open loop: each request is due at a fixed time, so a slow server doesn't
  // quietly lower the rate. The in-flight cap stops a pile-up if it's very
  // slow, and a 429 pauses everything until its Retry-After.
  const due = t0 + (n - 1) * intervalMs;
  while (!stopping) {
    const now = Date.now();
    const waitUntil = Math.max(due, pausedUntil);
    if (now >= waitUntil && inFlight < maxInFlight) break;
    await sleep(Math.min(250, Math.max(50, waitUntil - now)));
  }
  if (stopping) break;
  // Fell behind (a pause, or the in-flight cap)? Start the spacing again from
  // now instead of firing the missed ones in a burst.
  const lag = Date.now() - due;
  if (lag > intervalMs) t0 += lag;
  inFlight++;
  pending.push(signInOnce(n).finally(() => inFlight--));
}

await Promise.allSettled(pending);
summarize();
process.exit(results.some((r) => r.status === 0 || r.status >= 500) ? 2 : 0);
