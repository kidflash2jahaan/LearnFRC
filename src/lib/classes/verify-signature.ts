/**
 * RealtimeKit webhook signatures (section 6.8, step 2).
 *
 * Cloudflare signs the raw request body with RSA-SHA256 (RSASSA-PKCS1-v1_5)
 * and sends the base64 signature in the `rtk-signature` header. The public key
 * is published at RTK_PUBLIC_KEY_URL (`data.publicKey`, a SPKI PEM). The
 * route reads the body with `await req.text()` and passes it here untouched:
 * re-serializing parsed JSON would change the bytes and fail every check.
 *
 * What a good signature proves, and what it doesn't: the key is the same for
 * every RealtimeKit customer and only the body is signed, so it proves
 * Cloudflare wrote this body, not that the delivery was meant for us or that
 * the unsigned headers (rtk-uuid, rtk-webhook-id) are real. The webhook route
 * also checks the meeting is one of ours, dedupes on the body's hash, and
 * drops stale events (section 6.8 steps 3 to 6).
 *
 * WebCrypto only, no `@/` imports and no `server-only`, so `node --test` runs
 * it (verify-signature.test.ts) with a key pair it makes on the spot.
 *
 * Fixture payloads (the webhooks package): under `node --test` only, the
 * verifier also accepts signatures from the public key in
 * RTK_TEST_PUBLIC_KEY (testPublicKeyOverride). Outside the test runner, or in
 * a production build, that variable is ignored.
 */

export const RTK_PUBLIC_KEY_URL = "https://api.realtime.cloudflare.com/.well-known/webhooks.json";

/** How long a fetched public key is trusted before it's fetched again. */
export const RTK_KEY_TTL_MS = 60 * 60 * 1000;

function base64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const clean = b64.replace(/\s+/g, "");
  const bin = atob(clean);
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** DER length bytes. */
function derLength(n: number): number[] {
  if (n < 0x80) return [n];
  const bytes: number[] = [];
  while (n > 0) {
    bytes.unshift(n & 0xff);
    n >>= 8;
  }
  return [0x80 | bytes.length, ...bytes];
}

/** Wraps a PKCS#1 RSAPublicKey in a SubjectPublicKeyInfo, so WebCrypto can import it. */
function pkcs1ToSpki(pkcs1: Uint8Array): Uint8Array<ArrayBuffer> {
  // AlgorithmIdentifier { rsaEncryption, NULL }
  const algId = [0x30, 0x0d, 0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01, 0x05, 0x00];
  const bitString = [0x03, ...derLength(pkcs1.length + 1), 0x00, ...pkcs1];
  const body = [...algId, ...bitString];
  const der = [0x30, ...derLength(body.length), ...body];
  const out = new Uint8Array(new ArrayBuffer(der.length));
  out.set(der);
  return out;
}

/** Imports a PEM (SPKI or PKCS#1) or bare base64 SPKI public key for verifying. */
export async function importRtkPublicKey(pem: string): Promise<CryptoKey> {
  const isPkcs1 = /BEGIN RSA PUBLIC KEY/.test(pem);
  const b64 = pem.replace(/-----(?:BEGIN|END)[^-]+-----/g, "").replace(/\\n/g, "\n");
  const der = base64ToBytes(b64);
  return crypto.subtle.importKey(
    "spki",
    isPkcs1 ? pkcs1ToSpki(der) : der,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"]
  );
}

/** True when `signatureB64` is a valid signature of `rawBody` under `key`. */
export async function verifyWithKey(rawBody: string, signatureB64: string, key: CryptoKey): Promise<boolean> {
  if (!signatureB64) return false;
  try {
    return await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      key,
      base64ToBytes(signatureB64),
      new TextEncoder().encode(rawBody)
    );
  } catch {
    return false;
  }
}

/** One-shot check with a PEM, for tests and scripts. */
export async function verifyRtkSignature(rawBody: string, signatureB64: string, publicKeyPem: string): Promise<boolean> {
  try {
    return await verifyWithKey(rawBody, signatureB64, await importRtkPublicKey(publicKeyPem));
  } catch {
    return false;
  }
}

/** Fetches the published key (`data.publicKey`). */
export async function fetchRtkPublicKey(fetchImpl: typeof fetch = fetch): Promise<string> {
  const res = await fetchImpl(RTK_PUBLIC_KEY_URL, { signal: AbortSignal.timeout(10_000), cache: "no-store" });
  if (!res.ok) throw new Error(`webhooks.json answered ${res.status}`);
  const json = (await res.json()) as { data?: { publicKey?: string } };
  const key = json?.data?.publicKey;
  if (!key) throw new Error("webhooks.json had no data.publicKey");
  return key;
}

/**
 * RTK_TEST_PUBLIC_KEY, but only inside `node --test` (which sets
 * NODE_TEST_CONTEXT in the processes it runs) and never in a production build.
 */
export function testPublicKeyOverride(env: Record<string, string | undefined> = process.env): string | null {
  if (env.NODE_ENV === "production") return null;
  if (!env.NODE_TEST_CONTEXT) return null;
  return env.RTK_TEST_PUBLIC_KEY || null;
}

export type RtkVerifier = {
  /** True when the signature is good, refetching the key once on a failure. */
  verify(rawBody: string, signatureB64: string | null | undefined): Promise<boolean>;
};

/**
 * A verifier that caches the published key for an hour, and on a failed check
 * refetches it once (Cloudflare may have rotated it) before saying no.
 */
export function createRtkVerifier(
  opts: {
    fetchKey?: () => Promise<string>;
    ttlMs?: number;
    now?: () => number;
    env?: Record<string, string | undefined>;
  } = {}
): RtkVerifier {
  const fetchKey = opts.fetchKey ?? (() => fetchRtkPublicKey());
  const ttl = opts.ttlMs ?? RTK_KEY_TTL_MS;
  const now = opts.now ?? Date.now;
  let cached: { key: CryptoKey; at: number } | null = null;

  async function load(force: boolean): Promise<CryptoKey | null> {
    if (!force && cached && now() - cached.at < ttl) return cached.key;
    try {
      const key = await importRtkPublicKey(await fetchKey());
      cached = { key, at: now() };
      return key;
    } catch {
      return cached?.key ?? null;
    }
  }

  return {
    async verify(rawBody, signatureB64) {
      if (!signatureB64) return false;
      const testPem = testPublicKeyOverride(opts.env);
      if (testPem && (await verifyRtkSignature(rawBody, signatureB64, testPem))) return true;
      const key = await load(false);
      if (key && (await verifyWithKey(rawBody, signatureB64, key))) return true;
      const fresh = await load(true);
      return !!fresh && fresh !== key && (await verifyWithKey(rawBody, signatureB64, fresh));
    },
  };
}
