/**
 * Cross-package stubs (classes-design.md section 15.1 step 6).
 *
 * Every function one classes package calls in another package's file was
 * committed by the Foundation with its final signature and a stub body that
 * calls this. In development it logs `[stub] <name>` and the stub returns a
 * neutral value, so a package can test its own code while its neighbour's
 * isn't built yet. Under NODE_ENV=production it throws, so a stub can never
 * ship quietly. The package that owns the file replaces the body and keeps
 * the signature; integration fails if any `stubCalled(` is left.
 *
 * No imports, so client components (the report panel stub) can use it too.
 */
export function stubCalled(name: string, detail?: unknown): void {
  if (process.env.NODE_ENV === "production") {
    throw new Error(`[stub] ${name} is not built yet`);
  }
  console.warn(`[stub] ${name}`, detail === undefined ? "" : detail);
}
