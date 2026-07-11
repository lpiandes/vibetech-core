import { deepFreeze } from "../workspace/_utils/deepFreeze.js";

/**
 * Safe public website fetch policy.
 * Only user-supplied / approved public URLs. No auth scraping.
 */
export const WEBSITE_FETCH_DEFAULTS = Object.freeze({
  timeoutMs: 8000,
  maxBytes: 500_000,
  maxPages: 3,
  allowedProtocols: ["https:", "http:"],
});

export function validateWebsiteUrl(url, { approvedUrls = [] } = {}) {
  if (!url || typeof url !== "string") {
    return deepFreeze({ ok: false, reason: "url_required" });
  }
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return deepFreeze({ ok: false, reason: "invalid_url" });
  }
  if (!WEBSITE_FETCH_DEFAULTS.allowedProtocols.includes(parsed.protocol)) {
    return deepFreeze({ ok: false, reason: "protocol_not_allowed" });
  }
  if (parsed.username || parsed.password) {
    return deepFreeze({ ok: false, reason: "authenticated_urls_forbidden" });
  }
  const approved = new Set(approvedUrls.map(String));
  if (approved.size > 0 && !approved.has(url) && !approved.has(parsed.origin)) {
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
