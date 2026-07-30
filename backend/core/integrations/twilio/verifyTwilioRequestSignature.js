/**
 * Validate inbound Twilio webhook requests using Twilio's standard request
 * signature algorithm: HMAC-SHA1(authToken, url + sorted "key"+"value" POST
 * params), base64-encoded, compared to the `X-Twilio-Signature` header.
 * https://www.twilio.com/docs/usage/webhooks/webhooks-security
 */
import crypto from "node:crypto";

function safeString(value) {
  return value === null || value === undefined ? "" : String(value);
}

/**
 * @param {{url: string, params?: Record<string, unknown>, authToken: string}} input
 */
export function computeTwilioSignature({ url, params = {}, authToken }) {
  const sortedKeys = Object.keys(params).sort();
  const data = sortedKeys.reduce((acc, key) => `${acc}${key}${safeString(params[key])}`, safeString(url));
  return crypto.createHmac("sha1", safeString(authToken)).update(Buffer.from(data, "utf8")).digest("base64");
}

function timingSafeEqualStrings(a, b) {
  const bufA = Buffer.from(safeString(a), "utf8");
  const bufB = Buffer.from(safeString(b), "utf8");
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * @param {{url: string, params?: Record<string, unknown>, authToken?: string|null, signature?: string|null}} input
 * @returns {boolean} true only when authToken and signature are present and match.
 */
export function verifyTwilioRequestSignature({ url, params = {}, authToken, signature }) {
  const token = safeString(authToken);
  const sig = safeString(signature);
  if (!token || !sig) return false;
  const expected = computeTwilioSignature({ url, params, authToken: token });
  return timingSafeEqualStrings(expected, sig);
}
