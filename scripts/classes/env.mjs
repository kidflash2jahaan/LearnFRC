// Loads a worktree's .env.local into process.env (without overriding values
// already set), for the classes scripts. Never prints a value.
//
//   import { loadEnv, repoRoot, devDir } from "./env.mjs";

import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** This checkout's root (the worktree the script lives in). */
export const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

/**
 * This worktree's .claude-scratch/classes-dev folder (git-ignored): the test
 * accounts' credentials files and the dev outbox. Per worktree, so packages
 * running at the same time never touch each other's files.
 */
export function devDir() {
  return process.env.CLASSES_DEV_DIR || join(repoRoot, ".claude-scratch", "classes-dev");
}

/** The main checkout (where keys.env and the shared .env.local live). */
export function mainCheckout() {
  try {
    const common = execSync("git rev-parse --path-format=absolute --git-common-dir", {
      cwd: repoRoot,
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim();
    return dirname(common);
  } catch {
    return repoRoot;
  }
}

/** Jahaan's keys file (Cloudflare, R2, AI Gateway). May be empty. */
export function keysFile() {
  return join(mainCheckout(), ".claude-scratch", "classes-dev", "keys.env");
}

/** Parses KEY=value lines (quotes optional, # comments). */
export function parseEnv(text) {
  const out = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const m = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    out[m[1]] = v;
  }
  return out;
}

/** Loads `<root>/.env.local` into process.env. Returns the names it set. */
export function loadEnv(root = repoRoot) {
  const file = join(root, ".env.local");
  if (!existsSync(file)) return [];
  const vals = parseEnv(readFileSync(file, "utf8"));
  const set = [];
  for (const [k, v] of Object.entries(vals)) {
    if (process.env[k] === undefined) {
      process.env[k] = v;
      set.push(k);
    }
  }
  return set;
}

/** Throws unless every name is set (names only in the message). */
export function requireEnv(...names) {
  const missing = names.filter((n) => !process.env[n]);
  if (missing.length) throw new Error(`missing env: ${missing.join(", ")} (run make-env.sh for this worktree)`);
}
