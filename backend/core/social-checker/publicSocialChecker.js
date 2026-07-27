/**
 * Public Social Checker — name-first multi-platform presence discovery.
 * Uses Serper discovery only (not the full FCRA screening pipeline).
 */
import { discoverSocialProfiles } from "../integrations/social-screening/serperSocialDiscovery.js";

const NETWORK_ORDER = Object.freeze([
  "linkedin",
  "instagram",
  "youtube",
  "x",
  "facebook",
  "tiktok",
  "web",
]);

/** @type {Map<string, number>} */
const rateBuckets = new Map();

/**
 * @param {Request} request
 * @returns {string}
 */
export function clientKeyFromRequest(request) {
  const forwarded = String(request.headers.get("x-forwarded-for") ?? "").split(",")[0].trim();
  const realIp = String(request.headers.get("x-real-ip") ?? "").trim();
  return forwarded || realIp || "anonymous";
}

/**
 * @param {{
 *   key?: string,
 *   limit?: number,
 *   now?: number,
 *   store?: Map<string, number>,
 * }} [opts]
 */
export function checkSocialCheckerRateLimit({
  key,
  limit = Number(process.env.SOCIAL_CHECKER_DAILY_LIMIT || 20),
  now = Date.now(),
  store = rateBuckets,
} = {}) {
  const day = new Date(now).toISOString().slice(0, 10);
  const bucketKey = `${day}:${String(key || "anonymous")}`;
  const used = Number(store.get(bucketKey) || 0);
  if (used >= limit) {
    return { ok: false, remaining: 0, limit, day };
  }
  store.set(bucketKey, used + 1);
  return { ok: true, remaining: Math.max(0, limit - used - 1), limit, day };
}

/**
 * @param {Array<{ network?: string, title?: string, url?: string, snippet?: string }>} [profiles]
 */
export function rankProfiles(profiles = []) {
  const scored = (Array.isArray(profiles) ? profiles : []).map((p, index) => {
    const network = String(p.network ?? "web").toLowerCase();
    const title = String(p.title ?? "");
    const snippet = String(p.snippet ?? "");
    const url = String(p.url ?? "");
    let score = 40;
    const orderIdx = NETWORK_ORDER.indexOf(network);
    if (orderIdx >= 0) score += (NETWORK_ORDER.length - orderIdx) * 4;
    if (/linkedin\.com\/in\//i.test(url)) score += 20;
    if (/profile|official|about/i.test(`${title} ${snippet}`)) score += 8;
    if (snippet.length > 40) score += 4;
    return {
      ...p,
      network,
      confidence: Math.min(99, score),
      rank: index,
    };
  });
  scored.sort((a, b) => b.confidence - a.confidence || a.rank - b.rank);
  return scored.map(({ rank, ...rest }) => rest);
}

/**
 * @param {{
 *   name?: string,
 *   handle?: string,
 *   serperApiKey?: string,
 *   fetchImpl?: typeof fetch,
 * }} [opts]
 */
export async function runPublicSocialCheck({
  name,
  handle = "",
  serperApiKey = process.env.SERPER_API_KEY,
  fetchImpl = globalThis.fetch?.bind(globalThis),
} = {}) {
  const subjectName = String(name ?? "").trim();
  const handleClean = String(handle ?? "").trim().replace(/^@/, "");
  if (!subjectName && !handleClean) {
    return { ok: false, reason: "name_required", profiles: [], searches: [] };
  }
  if (!String(serperApiKey ?? "").trim()) {
    return { ok: false, reason: "serper_api_key_missing", profiles: [], searches: [] };
  }

  const discovered = await discoverSocialProfiles({
    subject: {
      name: subjectName || handleClean,
      handles: handleClean ? [handleClean] : [],
    },
    serperApiKey: String(serperApiKey).trim(),
    fetchImpl,
    maxPerNetwork: 3,
  });

  if (!discovered.ok) {
    return {
      ok: false,
      reason: discovered.reason ?? "discovery_failed",
      profiles: [],
      searches: discovered.searches ?? [],
    };
  }

  const profiles = rankProfiles(discovered.profiles);
  /** @type {Record<string, typeof profiles>} */
  const byNetwork = {};
  for (const p of profiles) {
    const key = p.network || "web";
    if (!byNetwork[key]) byNetwork[key] = [];
    byNetwork[key].push(p);
  }

  return {
    ok: true,
    subject: { name: subjectName, handle: handleClean || null },
    profiles,
    byNetwork,
    searches: discovered.searches ?? [],
    generatedAt: new Date().toISOString(),
    disclaimer:
      "Public OSINT-style social presence context only. Not an employment, tenant, or FCRA background screen.",
  };
}
