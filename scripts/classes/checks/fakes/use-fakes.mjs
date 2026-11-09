// Swaps two neighbour stubs for this folder's fakes, for the letters checks:
//   @/lib/app/class-teachers  -> ./class-teachers.ts  (getTeacher reads class_teachers)
//   @/lib/app/class-reviewers -> ./class-reviewers.ts (super admin or safety lead)
// Import it before anything imports those modules (the checks import all
// src code dynamically, after this). Hooks registered later run first, so
// these win over scripts/classes/register.mjs for the two specifiers only.
// Plain .mjs because @types/node 20 doesn't declare registerHooks yet.

import { registerHooks } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const FAKES = {
  "@/lib/app/class-teachers": pathToFileURL(join(HERE, "class-teachers.ts")).href,
  "@/lib/app/class-reviewers": pathToFileURL(join(HERE, "class-reviewers.ts")).href,
};

registerHooks({
  resolve(specifier, context, nextResolve) {
    const fake = FAKES[specifier];
    if (fake) return { url: fake, shortCircuit: true };
    return nextResolve(specifier, context);
  },
});

/** Calls the fakes recorded, so a check can see the letters code used them. */
export function fakeCalls() {
  return (globalThis.__lettersFakeCalls ??= []);
}
