// Signs fixture webhook bodies the way RealtimeKit does: base64
// RSASSA-PKCS1-v1_5 / SHA-256 over the raw body, in the `rtk-signature`
// header (classes-design.md 6.8). The key pair is made fresh for each run and
// never written anywhere. The verifier (src/lib/classes/verify-signature.ts)
// accepts its public key only under `node --test`, through
// RTK_TEST_PUBLIC_KEY.

import { randomUUID } from "node:crypto";

export async function makeTestSigner() {
  const pair = await crypto.subtle.generateKey(
    { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
    true,
    ["sign", "verify"]
  );
  const spki = Buffer.from(await crypto.subtle.exportKey("spki", pair.publicKey)).toString("base64");
  const publicKeyPem = `-----BEGIN PUBLIC KEY-----\n${spki.replace(/(.{64})/g, "$1\n")}\n-----END PUBLIC KEY-----`;

  async function sign(raw) {
    const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", pair.privateKey, new TextEncoder().encode(raw));
    return Buffer.from(sig).toString("base64");
  }

  /**
   * A webhook delivery as a Request. `raw` defaults to JSON.stringify(body);
   * pass `uuid` to reuse a delivery id, `signature` to send a different one.
   */
  async function request(body, opts = {}) {
    const raw = opts.raw ?? JSON.stringify(body);
    const headers = {
      "content-type": "application/json",
      "rtk-uuid": opts.uuid ?? randomUUID(),
      "rtk-signature": opts.signature ?? (await sign(raw)),
    };
    if (opts.webhookId !== null) headers["rtk-webhook-id"] = opts.webhookId ?? "fixture-webhook";
    return { req: new Request("http://localhost/api/classes/webhook", { method: "POST", headers, body: raw }), uuid: headers["rtk-uuid"], raw };
  }

  return { publicKeyPem, sign, request };
}
