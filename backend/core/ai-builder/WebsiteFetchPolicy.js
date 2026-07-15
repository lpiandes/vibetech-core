import { deepFreeze } from "../workspace/_utils/deepFreeze.js";

/**
 * Safe public website fetch policy.
 * Only user-supplied / approved public URLs. No auth scraping.
 */
export const WEBSITE_FETCH_DEFAULTS = Object.freeze({
  timeoutMs: 12_000,
  maxBytes: 500_000,
  maxPages: 3,
  allowedProtocols: ["https:", "http:"],
});

/**
 * Accept bare domains like www.magna-mare.com (owners rarely type https://).
 */
export function normalizeWebsiteUrl(url) {
  const raw = String(url ?? "").trim();
  if (!raw) return "";
  if (/^(i\s*don'?t\s*have|no\s*website|none|n\/a|na)\b/i.test(raw)) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  if (/^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}([/:?#].*)?$/i.test(raw)) {
    return `https://${raw}`;
  }
  return raw;
}

export function validateWebsiteUrl(url, { approvedUrls = [] } = {}) {
  const normalized = normalizeWebsiteUrl(url);
  if (!normalized) {
    return deepFreeze({ ok: false, reason: "url_required" });
  }
  let parsed;
  try {
    parsed = new URL(normalized);
  } catch {
    return deepFreeze({ ok: false, reason: "invalid_url" });
  }
  if (!WEBSITE_FETCH_DEFAULTS.allowedProtocols.includes(parsed.protocol)) {
    return deepFreeze({ ok: false, reason: "protocol_not_allowed" });
  }
  if (parsed.username || parsed.password) {
    return deepFreeze({ ok: false, reason: "authenticated_urls_forbidden" });
  }
  const approvedNormalized = (approvedUrls ?? [])
    .map((entry) => normalizeWebsiteUrl(entry))
    .filter(Boolean)
    .flatMap((entry) => {
      try {
        const approvedParsed = new URL(entry);
        return [entry, approvedParsed.origin, approvedParsed.href, approvedParsed.hostname];
      } catch {
        return [entry];
      }
    });
  const approved = new Set(approvedNormalized);
  if (approved.size > 0
    && !approved.has(normalized)
    && !approved.has(parsed.href)
    && !approved.has(parsed.origin)
    && !approved.has(parsed.hostname)
    && !approved.has(String(url ?? "").trim())) {
    return deepFreeze({ ok: false, reason: "url_not_approved" });
  }
  return deepFreeze({ ok: true, url: parsed.toString(), origin: parsed.origin });
}

export function createWebsiteFetchPolicy(overrides = {}) {
  return deepFreeze({
    ...WEBSITE_FETCH_DEFAULTS,
    ...overrides,
  });
}
