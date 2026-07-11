// Shared font loader for all Open Graph images so the link-preview thumbnails
// use the site's display face (Baloo 2), not next/og's default sans. Wrapped in
// try/catch: if the font can't load for any reason, we return undefined and the
// OG image still renders (default font) rather than 500-ing and breaking every
// link preview.
type OgFont = {
  name: string;
  data: ArrayBuffer;
  weight: 400 | 800;
  style: "normal";
};

let cache: OgFont[] | undefined;

export async function ogFonts(): Promise<OgFont[] | undefined> {
  if (cache) return cache;
  try {
    const [b800, b400] = await Promise.all([
      fetch(new URL("./baloo-800.woff", import.meta.url)).then((r) =>
        r.arrayBuffer()
      ),
      fetch(new URL("./baloo-400.woff", import.meta.url)).then((r) =>
        r.arrayBuffer()
      ),
    ]);
    cache = [
      { name: "Baloo 2", data: b800, weight: 800, style: "normal" },
      { name: "Baloo 2", data: b400, weight: 400, style: "normal" },
    ];
    return cache;
  } catch {
    return undefined;
  }
}
