import { test } from "node:test";
import assert from "node:assert/strict";
import { copyUrlToR2, deletePrefix, headObject, presignGet, r2Endpoint, type R2Config } from "./r2.ts";

const SOURCE = "https://rtk.example/recordings/rec.mp4";

/** A fake R2 (S3 API) plus the source download, recording every call. */
function fakeR2(opts: { sourceBytes: number; chunk?: number; failPart?: number; failSource?: boolean; keys?: string[] }) {
  const calls: { method: string; url: URL; body: Uint8Array; auth: string | null; sha: string | null }[] = [];
  const store = new Map<string, Uint8Array>();
  const parts = new Map<number, Uint8Array>();
  const listed = [...(opts.keys ?? [])];
  const fetchImpl = async (req: Request): Promise<Response> => {
    const url = new URL(req.url);
    const body = new Uint8Array(await req.arrayBuffer());
    calls.push({
      method: req.method,
      url,
      body,
      auth: req.headers.get("Authorization"),
      sha: req.headers.get("X-Amz-Content-Sha256"),
    });
    if (url.href === SOURCE) {
      if (opts.failSource) return new Response("nope", { status: 403 });
      const chunk = opts.chunk ?? 3 * 1024 * 1024 + 7;
      let sent = 0;
      const stream = new ReadableStream<Uint8Array>({
        pull(ctrl) {
          if (sent >= opts.sourceBytes) return ctrl.close();
          const n = Math.min(chunk, opts.sourceBytes - sent);
          const b = new Uint8Array(n);
          for (let i = 0; i < n; i++) b[i] = (sent + i) % 251;
          sent += n;
          ctrl.enqueue(b);
        },
      });
      return new Response(stream, { status: 200 });
    }
    if (req.method === "POST" && url.searchParams.has("uploads"))
      return new Response("<InitiateMultipartUploadResult><UploadId>up-1</UploadId></InitiateMultipartUploadResult>");
    if (req.method === "PUT" && url.searchParams.has("partNumber")) {
      const n = Number(url.searchParams.get("partNumber"));
      if (n === opts.failPart) return new Response("<Error><Code>InternalError</Code></Error>", { status: 500 });
      parts.set(n, body);
      return new Response("", { headers: { ETag: `"etag-${n}"` } });
    }
    if (req.method === "POST" && url.searchParams.has("uploadId")) {
      const all = [...parts.entries()].sort((a, b) => a[0] - b[0]).map(([, b]) => b);
      const joined = new Uint8Array(all.reduce((s, b) => s + b.byteLength, 0));
      let o = 0;
      for (const b of all) {
        joined.set(b, o);
        o += b.byteLength;
      }
      store.set(url.pathname, joined);
      return new Response("<CompleteMultipartUploadResult></CompleteMultipartUploadResult>");
    }
    if (req.method === "DELETE" && url.searchParams.has("uploadId")) return new Response(null, { status: 204 });
    if (req.method === "PUT") {
      store.set(url.pathname, body);
      return new Response("");
    }
    if (req.method === "HEAD") {
      const b = store.get(url.pathname);
      return b ? new Response(null, { headers: { "Content-Length": String(b.byteLength) } }) : new Response(null, { status: 404 });
    }
    if (req.method === "GET" && url.searchParams.get("list-type") === "2") {
      const prefix = url.searchParams.get("prefix") ?? "";
      const keys = listed.filter((k) => k.startsWith(prefix));
      return new Response(
        `<ListBucketResult><IsTruncated>false</IsTruncated>${keys.map((k) => `<Contents><Key>${k}</Key></Contents>`).join("")}</ListBucketResult>`
      );
    }
    if (req.method === "DELETE") {
      const key = decodeURIComponent(url.pathname.split("/").slice(2).join("/"));
      const i = listed.indexOf(key);
      if (i >= 0) listed.splice(i, 1);
      return new Response(null, { status: 204 });
    }
    return new Response("unexpected", { status: 400 });
  };
  const cfg: R2Config = {
    accountId: "acct123",
    accessKeyId: "AKIDEXAMPLE",
    secretAccessKey: "secretexample",
    bucket: "learnfrc-class-holds-dev",
    fetchImpl,
  };
  return { cfg, calls, store, parts, listed };
}

const PART = 1024 * 1024; // 1 MiB parts keep the test fast; the real size is 10 MiB.

test("a multi-part copy uploads equal parts but the last, in order, and completes", async () => {
  const total = 3 * PART + 12345;
  const r2 = fakeR2({ sourceBytes: total, chunk: 300_001 });
  const res = await copyUrlToR2(r2.cfg, SOURCE, "holds/c-1/s-1.mp4", { partBytes: PART });
  assert.deepEqual(res, { ok: true, bytes: total, parts: 4 });
  assert.deepEqual([...r2.parts.keys()], [1, 2, 3, 4]);
  for (const n of [1, 2, 3]) assert.equal(r2.parts.get(n)!.byteLength, PART, `part ${n} is full`);
  assert.equal(r2.parts.get(4)!.byteLength, 12345);
  const stored = r2.store.get("/learnfrc-class-holds-dev/holds/c-1/s-1.mp4")!;
  assert.equal(stored.byteLength, total);
  assert.equal(stored[PART + 5], (PART + 5) % 251, "bytes arrive unchanged and in order");
  const complete = r2.calls.find((c) => c.method === "POST" && c.url.searchParams.has("uploadId"))!;
  const xml = new TextDecoder().decode(complete.body);
  assert.match(xml, /<Part><PartNumber>1<\/PartNumber><ETag>"etag-1"<\/ETag><\/Part>/);
  assert.match(xml, /<PartNumber>4<\/PartNumber>/);
  const r2Calls = r2.calls.filter((c) => c.url.href !== SOURCE);
  assert.ok(r2Calls.every((c) => c.url.host === "acct123.r2.cloudflarestorage.com"));
  assert.ok(r2Calls.every((c) => c.auth?.startsWith("AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE/")), "every call is signed");
  assert.ok(r2Calls.every((c) => c.auth?.includes("/auto/s3/aws4_request")), "region auto, service s3");
});

test("an exact multiple of the part size has no empty last part", async () => {
  const r2 = fakeR2({ sourceBytes: 2 * PART });
  const res = await copyUrlToR2(r2.cfg, SOURCE, "holds/c/s.mp4", { partBytes: PART });
  assert.deepEqual(res, { ok: true, bytes: 2 * PART, parts: 2 });
  assert.equal(r2.parts.size, 2);
});

test("a small recording goes up with one PUT", async () => {
  const r2 = fakeR2({ sourceBytes: 5000 });
  const res = await copyUrlToR2(r2.cfg, SOURCE, "holds/c/s.mp4", { partBytes: PART });
  assert.deepEqual(res, { ok: true, bytes: 5000, parts: 1 });
  assert.ok(!r2.calls.some((c) => c.url.searchParams.has("uploads")), "no multipart");
  assert.equal(r2.store.get("/learnfrc-class-holds-dev/holds/c/s.mp4")?.byteLength, 5000);
});

test("a failed part aborts the upload", async () => {
  const r2 = fakeR2({ sourceBytes: 3 * PART, failPart: 2 });
  const res = await copyUrlToR2(r2.cfg, SOURCE, "holds/c/s.mp4", { partBytes: PART });
  assert.equal(res.ok, false);
  if (!res.ok) assert.match(res.error, /part 2 http_500 InternalError/);
  assert.ok(
    r2.calls.some((c) => c.method === "DELETE" && c.url.searchParams.get("uploadId") === "up-1"),
    "abort sent"
  );
  assert.ok(!r2.calls.some((c) => c.method === "POST" && c.url.searchParams.has("uploadId")), "never completed");
});

test("a source that refuses or is empty is a failure, not an empty object", async () => {
  const denied = await copyUrlToR2(fakeR2({ sourceBytes: 10, failSource: true }).cfg, SOURCE, "k", { partBytes: PART });
  assert.deepEqual(denied, { ok: false, error: "source http_403" });
  const empty = await copyUrlToR2(fakeR2({ sourceBytes: 0 }).cfg, SOURCE, "k", { partBytes: PART });
  assert.deepEqual(empty, { ok: false, error: "source empty" });
});

test("presignGet makes a 15-minute signed link and sends nothing", async () => {
  const r2 = fakeR2({ sourceBytes: 0 });
  const res = await presignGet(r2.cfg, "holds/c-1/s-1.mp4");
  assert.equal(res.ok, true);
  if (!res.ok) return;
  const u = new URL(res.url);
  assert.equal(u.origin, r2Endpoint("acct123"));
  assert.equal(u.pathname, "/learnfrc-class-holds-dev/holds/c-1/s-1.mp4");
  assert.equal(u.searchParams.get("X-Amz-Expires"), "900");
  assert.ok(u.searchParams.get("X-Amz-Signature"));
  assert.match(u.searchParams.get("X-Amz-Credential") ?? "", /^AKIDEXAMPLE\/\d{8}\/auto\/s3\/aws4_request$/);
  assert.equal(r2.calls.length, 0);
});

test("headObject and deletePrefix", async () => {
  const r2 = fakeR2({ sourceBytes: 5000, keys: ["holds/c-1/a.mp4", "holds/c-1/b.mp4", "holds/c-2/a.mp4"] });
  assert.deepEqual(await headObject(r2.cfg, "holds/c-9/x.mp4"), { ok: true, exists: false, bytes: null });
  await copyUrlToR2(r2.cfg, SOURCE, "holds/c-9/x.mp4", { partBytes: PART });
  assert.deepEqual(await headObject(r2.cfg, "holds/c-9/x.mp4"), { ok: true, exists: true, bytes: 5000 });
  assert.deepEqual(await deletePrefix(r2.cfg, "holds/c-1/"), { ok: true, deleted: 2 });
  assert.deepEqual(r2.listed, ["holds/c-2/a.mp4"]);
  assert.equal((await deletePrefix(r2.cfg, "")).ok, false, "never deletes the whole bucket");
});
