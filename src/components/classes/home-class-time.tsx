"use client";

import { useSyncExternalStore } from "react";
import { formatClassWhenLocal, formatClassWhenUtc } from "@/components/classes/home-format";

/** Nothing to subscribe to: the only change is server render to browser. */
const subscribe = () => () => {};
const inBrowser = () => true;
const onServer = () => false;

/**
 * A class's start time on the cached homepage: UTC in the server's HTML, the
 * reader's own time zone after hydration. useSyncExternalStore renders the
 * server snapshot during hydration and swaps right after, so there's no
 * mismatch warning and no hand-rolled `mounted` flag.
 */
export function HomeClassTime({ iso }: { iso: string }) {
  const local = useSyncExternalStore(subscribe, inBrowser, onServer);
  return <time dateTime={iso}>{local ? formatClassWhenLocal(iso) : formatClassWhenUtc(iso)}</time>;
}
