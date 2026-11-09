import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createRtkVerifier,
  importRtkPublicKey,
  testPublicKeyOverride,
  verifyRtkSignature,
} from "./verify-signature.ts";

async function keyPair() {
  const pair = await crypto.subtle.generateKey(
    { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
    true,
    ["sign", "verify"]
  );
  const spki = new Uint8Array(await crypto.subtle.exportKey("spki", pair.publicKey));
  const b64 = Buffer.from(spki).toString("base64").replace(/(.{64})/g, "$1\n");
  const pem = `-----BEGIN PUBLIC KEY-----\n${b64}\n-----END PUBLIC KEY-----`;
  const sign = async (body: string) =>
    Buffer.from(
      await crypto.subtle.sign("RSASSA-PKCS1-v1_5", pair.privateKey, new TextEncoder().encode(body))
    ).toString("base64");
  return { pem, sign, spki };
}

const BODY = JSON.stringify({ event: "meeting.started", meeting: { id: "m-1", startedAt: "2026-11-20T01:00:00Z" } });

test("a good signature verifies", async () => {
  const k = await keyPair();
  assert.equal(await verifyRtkSignature(BODY, await k.sign(BODY), k.pem), true);
});

test("a tampered body fails", async () => {
  const k = await keyPair();
  const sig = await k.sign(BODY);
  assert.equal(await verifyRtkSignature(BODY.replace("m-1", "m-2"), sig, k.pem), false);
  // Re-serializing changes the bytes too.
  assert.equal(await verifyRtkSignature(JSON.stringify(JSON.parse(BODY), null, 1), sig, k.pem), false);
});

test("the wrong key fails", async () => {
  const signer = await keyPair();
  const other = await keyPair();
  assert.equal(await verifyRtkSignature(BODY, await signer.sign(BODY), other.pem), false);
});

test("garbage and missing signatures fail without throwing", async () => {
  const k = await keyPair();
  assert.equal(await verifyRtkSignature(BODY, "", k.pem), false);
  assert.equal(await verifyRtkSignature(BODY, "not base64 !!", k.pem), false);
  assert.equal(await verifyRtkSignature(BODY, await k.sign(BODY), "not a key"), false);
});

test("the published key's format imports (SPKI PEM with escaped newlines too)", async () => {
  const k = await keyPair();
  await importRtkPublicKey(k.pem);
  await importRtkPublicKey(k.pem.replace(/\n/g, "\\n"));
});

test("the verifier caches the key and refetches once on a failure (key rotation)", async () => {
  const oldKey = await keyPair();
  const newKey = await keyPair();
  let served = oldKey.pem;
  let fetches = 0;
  const verifier = createRtkVerifier({
    fetchKey: async () => {
      fetches++;
      return served;
    },
    env: {},
  });
  assert.equal(await verifier.verify(BODY, await oldKey.sign(BODY)), true);
  assert.equal(await verifier.verify(BODY, await oldKey.sign(BODY)), true);
  assert.equal(fetches, 1, "cached for the second call");
  served = newKey.pem;
  assert.equal(await verifier.verify(BODY, await newKey.sign(BODY)), true);
  assert.equal(fetches, 2, "one refetch after the failure");
  assert.equal(await verifier.verify(BODY, null), false);
});

test("the test key is honoured only under node --test and never in production", async () => {
  const k = await keyPair();
  assert.equal(testPublicKeyOverride({ RTK_TEST_PUBLIC_KEY: k.pem }), null);
  assert.equal(testPublicKeyOverride({ RTK_TEST_PUBLIC_KEY: k.pem, NODE_TEST_CONTEXT: "child-v8", NODE_ENV: "production" }), null);
  assert.equal(testPublicKeyOverride({ RTK_TEST_PUBLIC_KEY: k.pem, NODE_TEST_CONTEXT: "child-v8" }), k.pem);
  const published = await keyPair();
  const verifier = createRtkVerifier({
    fetchKey: async () => published.pem,
    env: { RTK_TEST_PUBLIC_KEY: k.pem, NODE_TEST_CONTEXT: "child-v8" },
  });
  assert.equal(await verifier.verify(BODY, await k.sign(BODY)), true);
  assert.equal(await verifier.verify(BODY, await published.sign(BODY)), true);
});
