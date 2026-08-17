/**
 * Complimentary VibeKeep signup (server-only). Never send the expected code to the browser.
 */
import { timingSafeEqual } from "node:crypto";

const DEFAULT_COMPLIMENTARY_CODE = "Crete88";

export function resolveVibeKeepComplimentaryCode() {
  const fromEnv = String(process.env.VIBEKEEP_COMPLIMENTARY_CODE ?? "").trim();
  return fromEnv || DEFAULT_COMPLIMENTARY_CODE;
}

/** Trim, drop internal spaces, compare case-insensitively. */
export function normalizeVibeKeepPromoCode(input) {
  return String(input ?? "").trim().replace(/\s+/g, "").toLowerCase();
}

export function isValidVibeKeepPromoCode(input) {
  const got = normalizeVibeKeepPromoCode(input);
  const expected = normalizeVibeKeepPromoCode(resolveVibeKeepComplimentaryCode());
  if (!got || !expected) return false;
  const a = Buffer.from(got, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
