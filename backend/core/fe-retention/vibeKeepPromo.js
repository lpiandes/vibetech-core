/**
 * Complimentary VibeKeep signup (server-only). Never send the expected code to the browser.
 */
import { timingSafeEqual } from "node:crypto";

const DEFAULT_COMPLIMENTARY_CODE = "Crete88";

export function resolveVibeKeepComplimentaryCode() {
  const fromEnv = String(process.env.VIBEKEEP_COMPLIMENTARY_CODE ?? "").trim();
  return fromEnv || DEFAULT_COMPLIMENTARY_CODE;
}

export function isValidVibeKeepPromoCode(input) {
  const got = String(input ?? "").trim();
  if (!got) return false;
  const expected = resolveVibeKeepComplimentaryCode();
  const a = Buffer.from(got, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
