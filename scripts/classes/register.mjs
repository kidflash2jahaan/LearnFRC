// Lets plain Node run the site's server-side TypeScript, for the classes
// packages' tests against shared functions (src/lib/app/*, src/lib/classes/*):
//
//   node --import ./scripts/classes/register.mjs path/to/check.ts
//
// Node 24 strips the types itself. These hooks add what Next's bundler does:
//   - `@/x` resolves to src/x(.ts|.tsx|/index.ts);
//   - extensionless relative imports inside src resolve to .ts or /index.ts;
//   - `server-only` resolves to an empty module (it throws outside React's
//     server build, and these scripts are server code by definition).
// Request-time APIs (cookies(), headers(), after()) still need a request, so
// code that reads them should take an override for tests or catch.
//
// Load the worktree's env first (scripts/classes/env.mjs does it), since
// nothing here reads .env.local.

import { registerHooks } from "node:module";
import { existsSync, statSync } from "node:fs";
import { dirname, join, resolve as resolvePath } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolvePath(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SRC = join(ROOT, "src");
const SHIM = pathToFileURL(join(ROOT, "scripts", "classes", "server-only-shim.mjs")).href;

function isFile(p) {
  try {
    return statSync(p).isFile();
  } catch {
    return false;
  }
}

function withTsExtension(p) {
  if (isFile(p)) return p;
  for (const ext of [".ts", ".tsx", ".mjs", ".js"]) if (isFile(p + ext)) return p + ext;
  for (const idx of ["index.ts", "index.tsx", "index.js"]) if (isFile(join(p, idx))) return join(p, idx);
  return null;
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "server-only") return { url: SHIM, shortCircuit: true };
    if (specifier.startsWith("@/")) {
      const found = withTsExtension(join(SRC, specifier.slice(2)));
      if (found) return { url: pathToFileURL(found).href, shortCircuit: true };
    }
    if (
      (specifier.startsWith("./") || specifier.startsWith("../")) &&
      context.parentURL?.startsWith("file:") &&
      fileURLToPath(context.parentURL).startsWith(SRC)
    ) {
      const base = resolvePath(dirname(fileURLToPath(context.parentURL)), specifier);
      if (!existsSync(base) || !isFile(base)) {
        const found = withTsExtension(base);
        if (found) return { url: pathToFileURL(found).href, shortCircuit: true };
      }
    }
    try {
      return nextResolve(specifier, context);
    } catch (e) {
      // Packages without an exports map (next/headers, next/server) need the
      // file extension under Node's ESM rules; the bundler adds it.
      const bareSubpath = /^(?:@[^/]+\/)?[^./][^/]*\/.+/.test(specifier) && !/\.[cm]?js$/.test(specifier);
      if (e?.code === "ERR_MODULE_NOT_FOUND" && bareSubpath) return nextResolve(`${specifier}.js`, context);
      throw e;
    }
  },
});
