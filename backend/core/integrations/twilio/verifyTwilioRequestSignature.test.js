import assert from "node:assert/strict";
import { test } from "node:test";

import { computeTwilioSignature, verifyTwilioRequestSignature } from "./verifyTwilioRequestSignature.js";

const URL = "https://app.example.com/api/businesses/biz_1/integrations/sms/inbound";
const PARAMS = { From: "+16035551212", Body: "Hi there", To: "+16035550000" };
const AUTH_TOKEN = "test_auth_token";

test("computeTwilioSignature is deterministic and order-independent for input param object", () => {
  const a = computeTwilioSignature({ url: URL, params: PARAMS, authToken: AUTH_TOKEN });
  const reordered = { To: PARAMS.To, From: PARAMS.From, Body: PARAMS.Body };
  const b = computeTwilioSignature({ url: URL, params: reordered, authToken: AUTH_TOKEN });
  assert.equal(a, b);
  assert.match(a, /^[A-Za-z0-9+/]+=*$/);
});

test("verifyTwilioRequestSignature accepts a signature computed the same way", () => {
  const signature = computeTwilioSignature({ url: URL, params: PARAMS, authToken: AUTH_TOKEN });
  assert.equal(
    verifyTwilioRequestSignature({ url: URL, params: PARAMS, authToken: AUTH_TOKEN, signature }),
    true,
  );
});

test("verifyTwilioRequestSignature rejects a tampered body", () => {
  const signature = computeTwilioSignature({ url: URL, params: PARAMS, authToken: AUTH_TOKEN });
  const tamperedParams = { ...PARAMS, Body: "Hi there, tampered" };
  assert.equal(
    verifyTwilioRequestSignature({ url: URL, params: tamperedParams, authToken: AUTH_TOKEN, signature }),
    false,
  );
});

test("verifyTwilioRequestSignature rejects a mismatched URL (e.g. wrong host from proxy rewrite)", () => {
  const signature = computeTwilioSignature({ url: URL, params: PARAMS, authToken: AUTH_TOKEN });
  assert.equal(
    verifyTwilioRequestSignature({
      url: "https://internal-proxy.local/api/businesses/biz_1/integrations/sms/inbound",
      params: PARAMS,
      authToken: AUTH_TOKEN,
      signature,
    }),
    false,
  );
});

test("verifyTwilioRequestSignature rejects the wrong auth token", () => {
  const signature = computeTwilioSignature({ url: URL, params: PARAMS, authToken: AUTH_TOKEN });
  assert.equal(
    verifyTwilioRequestSignature({ url: URL, params: PARAMS, authToken: "wrong_token", signature }),
    false,
  );
});

test("verifyTwilioRequestSignature rejects missing signature or missing auth token", () => {
  assert.equal(verifyTwilioRequestSignature({ url: URL, params: PARAMS, authToken: AUTH_TOKEN, signature: "" }), false);
  assert.equal(verifyTwilioRequestSignature({ url: URL, params: PARAMS, authToken: AUTH_TOKEN, signature: null }), false);
  const signature = computeTwilioSignature({ url: URL, params: PARAMS, authToken: AUTH_TOKEN });
  assert.equal(verifyTwilioRequestSignature({ url: URL, params: PARAMS, authToken: "", signature }), false);
});
