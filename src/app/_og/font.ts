import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

/**
 * Shared font loader for every Open Graph image, so link-preview thumbnails use
 * the site's display face (Baloo 2) instead of next/og's default sans.
 *
 * WHY THIS ISN'T `fetch(new URL(...))` ANYMORE
 * --------------------------------------------
 * Turbopack rewrites `new URL("./x.woff", import.meta.url)` to the asset it
 * emitted into the *server* build output — a `file:` URL, e.g.
 *   file:///…/.next/dev/server/assets/baloo-800.0qba4ek51r-in.woff
 * Node's fetch (undici) does not implement the `file:` protocol: it throws
 * `TypeError: fetch failed` with `cause: Error: not implemented... yet...`.
 * The old try/catch swallowed that, returned undefined, and every OG image
 * site-wide silently rendered in the fallback sans — including in production.
 *
 * So: resolve the asset through the bundler exactly as before (that part was
 * fine, and it's what guarantees the .woff ships with the server bundle), then
 * read it off disk with fs. The http(s)/data branch is kept so the loader still
 * works if the asset is ever emitted as a URL instead (edge runtime).
 *
 * The URLs are built at module scope with *literal* specifiers — a dynamic
 * specifier is not statically analysable, so the bundler would not emit the
 * asset and production would 404.
 */
type OgFont = {
  name: string;
  data: ArrayBuffer | Buffer;
  weight: 400 | 800;
  style: "normal";
};

const SOURCES = [
  { weight: 800 as const, url: new URL("./baloo-800.woff", import.meta.url) },
  { weight: 400 as const, url: new URL("./baloo-400.woff", import.meta.url) },
];

let cache: OgFont[] | undefined;

async function readAsset(url: URL): Promise<ArrayBuffer | Buffer> {
  if (url.protocol === "file:") return readFile(fileURLToPath(url));
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url.href} responded ${res.status}`);
  return res.arrayBuffer();
}

export async function ogFonts(): Promise<OgFont[] | undefined> {
  if (cache) return cache;
  try {
    const loaded = await Promise.all(
      SOURCES.map(async ({ weight, url }) => ({
        name: "Baloo 2",
        data: await readAsset(url),
        weight,
        style: "normal" as const,
      })),
    );
    cache = loaded;
    return cache;
  } catch (err) {
    // Loud, always — a silent fallback here is what let the brand font go
    // missing from every link preview on the site for weeks.
    console.error("[og-font] failed to load Baloo 2 for OG images:", err);
    if (process.env.NODE_ENV === "development") {
      // In dev, fail the image outright so the regression is impossible to
      // miss. In production we still degrade to the default sans rather than
      // 500-ing and breaking every link preview.
      throw err;
    }
    return undefined;
  }
}
