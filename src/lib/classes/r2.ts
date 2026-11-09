/**
 * The private R2 holds bucket (classes-design.md sections 8.2 and 13.4),
 * through R2's S3 API signed with aws4fetch.
 *
 * Only evidence holds use it: a held class's composite recording is streamed
 * from RealtimeKit's 7-day download link into the bucket in 10 MB parts, a
 * reviewer gets a 15-minute signed link to watch it, and the daily sweep
 * deletes it when its hold expires.
 *
 * Credentials come in as arguments (holds.ts reads them from config.ts), and
 * the module imports nothing from `@/`, so `node --test` runs it against a
 * fake fetch. Never import it into a client component: the config it's handed
 * is a secret. Every call returns `{ ok: true, ... }` or `{ ok: false, error }`
 * and never throws.
 */
import { AwsClient } from "aws4fetch";
import { RECORDING_LINK_SECONDS, RECORDING_PART_BYTES } from "./hold-rules.ts";

export type R2Config = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  /** Tests pass a fake. Default: the global fetch. */
  fetchImpl?: (req: Request) => Promise<Response>;
};

export type R2Fail = { ok: false; error: string };

const PART_TIMEOUT_MS = 60_000;
const CALL_TIMEOUT_MS = 20_000;

export function r2Endpoint(accountId: string): string {
  return `https://${accountId}.r2.cloudflarestorage.com`;
}

function objectUrl(cfg: R2Config, key: string): URL {
  const path = key.split("/").map(encodeURIComponent).join("/");
  return new URL(`${r2Endpoint(cfg.accountId)}/${encodeURIComponent(cfg.bucket)}/${path}`);
}

function client(cfg: R2Config): AwsClient {
  return new AwsClient({
    accessKeyId: cfg.accessKeyId,
    secretAccessKey: cfg.secretAccessKey,
    service: "s3",
    region: "auto",
    retries: 0,
  });
}

async function send(cfg: R2Config, url: URL, init: RequestInit & { timeoutMs?: number }): Promise<Response> {
  const { timeoutMs, ...rest } = init;
  const signed = await client(cfg).sign(url, {
    ...rest,
    signal: AbortSignal.timeout(timeoutMs ?? CALL_TIMEOUT_MS),
  });
  return (cfg.fetchImpl ?? fetch)(signed);
}

async function failText(res: Response): Promise<string> {
  const body = await res.text().catch(() => "");
  const code = /<Code>([^<]+)<\/Code>/.exec(body)?.[1];
  return `http_${res.status}${code ? ` ${code}` : ""}`;
}

function errorOf(e: unknown): string {
  const err = e as Error;
  if (err?.name === "TimeoutError" || err?.name === "AbortError") return "timeout";
  return (err?.message || "network").slice(0, 200);
}

const xmlEscape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/* ── Copy a recording in ───────────────────────────────────────────── */

export type CopyResult = { ok: true; bytes: number; parts: number } | R2Fail;

/**
 * Streams `sourceUrl` (RealtimeKit's presigned download link) into `key`.
 * Parts are exactly `partBytes` each except the last (R2 needs equal parts),
 * uploaded one at a time so at most one part sits in memory. A recording that
 * fits in one part goes up with a single PUT. Any failure aborts the
 * multipart upload, so no half object is left behind.
 */
export async function copyUrlToR2(
  cfg: R2Config,
  sourceUrl: string,
  key: string,
  opts: { contentType?: string; partBytes?: number; signal?: AbortSignal } = {}
): Promise<CopyResult> {
  const partBytes = opts.partBytes ?? RECORDING_PART_BYTES;
  const contentType = opts.contentType ?? "video/mp4";
  const doFetch = cfg.fetchImpl ?? fetch;

  let source: Response;
  try {
    source = await doFetch(new Request(sourceUrl, { signal: opts.signal }));
  } catch (e) {
    return { ok: false, error: `source ${errorOf(e)}` };
  }
  if (!source.ok || !source.body) return { ok: false, error: `source http_${source.status}` };

  const reader = source.body.getReader();
  let buffer = new Uint8Array(partBytes);
  let filled = 0;
  let total = 0;
  let uploadId: string | null = null;
  const etags: string[] = [];
  const url = objectUrl(cfg, key);

  const abort = async () => {
    if (!uploadId) return;
    const u = new URL(url);
    u.searchParams.set("uploadId", uploadId);
    await send(cfg, u, { method: "DELETE" }).catch(() => null);
  };

  const uploadPart = async (bytes: Uint8Array<ArrayBuffer>): Promise<string | null> => {
    if (!uploadId) {
      const u = new URL(url);
      u.searchParams.set("uploads", "");
      const res = await send(cfg, u, { method: "POST", headers: { "Content-Type": contentType } });
      if (!res.ok) return `start ${await failText(res)}`;
      const id = /<UploadId>([^<]+)<\/UploadId>/.exec(await res.text())?.[1];
      if (!id) return "start: no UploadId";
      uploadId = id;
    }
    const u = new URL(url);
    u.searchParams.set("partNumber", String(etags.length + 1));
    u.searchParams.set("uploadId", uploadId);
    const res = await send(cfg, u, { method: "PUT", body: bytes, timeoutMs: PART_TIMEOUT_MS });
    if (!res.ok) return `part ${etags.length + 1} ${await failText(res)}`;
    const etag = res.headers.get("ETag");
    if (!etag) return `part ${etags.length + 1}: no ETag`;
    etags.push(etag);
    return null;
  };

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      let chunk = value;
      total += chunk.byteLength;
      while (chunk.byteLength > 0) {
        const take = Math.min(partBytes - filled, chunk.byteLength);
        buffer.set(chunk.subarray(0, take), filled);
        filled += take;
        chunk = chunk.subarray(take);
        if (filled === partBytes) {
          const err = await uploadPart(buffer);
          if (err) {
            await abort();
            return { ok: false, error: err };
          }
          buffer = new Uint8Array(partBytes);
          filled = 0;
        }
      }
    }
  } catch (e) {
    await abort();
    return { ok: false, error: `source ${errorOf(e)}` };
  }

  if (total === 0) return { ok: false, error: "source empty" };

  try {
    // Small enough for one request: a plain PUT, no multipart.
    if (!uploadId) {
      const res = await send(cfg, url, {
        method: "PUT",
        body: buffer.subarray(0, filled),
        headers: { "Content-Type": contentType },
        timeoutMs: PART_TIMEOUT_MS,
      });
      if (!res.ok) return { ok: false, error: `put ${await failText(res)}` };
      return { ok: true, bytes: total, parts: 1 };
    }
    if (filled > 0) {
      const err = await uploadPart(buffer.subarray(0, filled));
      if (err) {
        await abort();
        return { ok: false, error: err };
      }
    }
    const u = new URL(url);
    u.searchParams.set("uploadId", uploadId);
    const xml =
      "<CompleteMultipartUpload>" +
      etags.map((e, i) => `<Part><PartNumber>${i + 1}</PartNumber><ETag>${xmlEscape(e)}</ETag></Part>`).join("") +
      "</CompleteMultipartUpload>";
    const res = await send(cfg, u, { method: "POST", body: xml, headers: { "Content-Type": "application/xml" } });
    const text = res.ok ? await res.text() : "";
    // S3 can answer 200 with an <Error> body on complete.
    if (!res.ok || /<Error>/.test(text)) {
      await abort();
      return { ok: false, error: `complete ${res.ok ? "error body" : await failText(res)}` };
    }
    return { ok: true, bytes: total, parts: etags.length };
  } catch (e) {
    await abort();
    return { ok: false, error: errorOf(e) };
  }
}

/* ── Read, list, delete ────────────────────────────────────────────── */

/** A signed GET link for one object, valid `seconds` (default 15 minutes). */
export async function presignGet(
  cfg: R2Config,
  key: string,
  seconds: number = RECORDING_LINK_SECONDS
): Promise<{ ok: true; url: string; expiresAt: string } | R2Fail> {
  try {
    const url = objectUrl(cfg, key);
    url.searchParams.set("X-Amz-Expires", String(Math.max(1, Math.min(seconds, 7 * 86_400))));
    const signed = await client(cfg).sign(url, { method: "GET", aws: { signQuery: true } });
    return { ok: true, url: signed.url, expiresAt: new Date(Date.now() + seconds * 1000).toISOString() };
  } catch (e) {
    return { ok: false, error: errorOf(e) };
  }
}

/** HEAD: whether the object exists, and its size. */
export async function headObject(
  cfg: R2Config,
  key: string
): Promise<{ ok: true; exists: boolean; bytes: number | null } | R2Fail> {
  try {
    const res = await send(cfg, objectUrl(cfg, key), { method: "HEAD" });
    if (res.status === 404) return { ok: true, exists: false, bytes: null };
    if (!res.ok) return { ok: false, error: `http_${res.status}` };
    const len = Number(res.headers.get("Content-Length"));
    return { ok: true, exists: true, bytes: Number.isFinite(len) ? len : null };
  } catch (e) {
    return { ok: false, error: errorOf(e) };
  }
}

/** Every key under `prefix` (ListObjectsV2, following continuation tokens). */
export async function listKeys(cfg: R2Config, prefix: string): Promise<{ ok: true; keys: string[] } | R2Fail> {
  const keys: string[] = [];
  let token: string | null = null;
  try {
    for (let page = 0; page < 50; page++) {
      const url = new URL(`${r2Endpoint(cfg.accountId)}/${encodeURIComponent(cfg.bucket)}`);
      url.searchParams.set("list-type", "2");
      url.searchParams.set("prefix", prefix);
      if (token) url.searchParams.set("continuation-token", token);
      const res = await send(cfg, url, { method: "GET" });
      if (!res.ok) return { ok: false, error: `list ${await failText(res)}` };
      const xml = await res.text();
      for (const m of xml.matchAll(/<Key>([^<]+)<\/Key>/g)) keys.push(unescapeXml(m[1]));
      const truncated = /<IsTruncated>true<\/IsTruncated>/.test(xml);
      token = /<NextContinuationToken>([^<]+)<\/NextContinuationToken>/.exec(xml)?.[1] ?? null;
      if (!truncated || !token) break;
      token = unescapeXml(token);
    }
    return { ok: true, keys };
  } catch (e) {
    return { ok: false, error: errorOf(e) };
  }
}

function unescapeXml(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

export async function deleteObject(cfg: R2Config, key: string): Promise<{ ok: true } | R2Fail> {
  try {
    const res = await send(cfg, objectUrl(cfg, key), { method: "DELETE" });
    // S3 answers 204 whether or not the object existed.
    if (!res.ok && res.status !== 404) return { ok: false, error: `delete ${await failText(res)}` };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errorOf(e) };
  }
}

/** Deletes every object under `prefix`. */
export async function deletePrefix(cfg: R2Config, prefix: string): Promise<{ ok: true; deleted: number } | R2Fail> {
  if (!prefix || prefix === "/") return { ok: false, error: "refusing an empty prefix" };
  const list = await listKeys(cfg, prefix);
  if (!list.ok) return list;
  let deleted = 0;
  for (const key of list.keys) {
    const r = await deleteObject(cfg, key);
    if (!r.ok) return r;
    deleted++;
  }
  return { ok: true, deleted };
}
