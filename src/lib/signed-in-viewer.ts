import { useSyncExternalStore } from "react";

/**
 * Whether the person reading is signed in, as far as the navbar has found out.
 *
 * The root layout is static, so nothing in it knows who is reading until the
 * navbar's /api/me answer comes back. The navbar writes that answer here, and
 * the rest of the chrome that changes for a signed-in reader (the logo, the
 * footer's team column) reads it, so a page load asks the server once instead
 * of once per component.
 *
 * On the server and until the answer arrives, this says "signed out", which is
 * what the cached HTML shows everyone, so hydration always matches and the
 * swap happens right after, the same way the navbar's own "My team" tab does.
 * Sign-in and sign-out both end in a full page load, so the value never has
 * to be cleared.
 *
 * Client components only.
 */
let signedIn = false;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function setViewerSignedIn(value: boolean) {
  if (value === signedIn) return;
  signedIn = value;
  listeners.forEach((l) => l());
}

export function useViewerSignedIn(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => signedIn,
    () => false
  );
}
