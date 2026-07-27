/**
 * Public Social Checker — deep multi-platform presence discovery.
 * Uses Serper discovery only (not the full FCRA screening pipeline).
 */
import {
  discoverSocialProfiles,
  SOCIAL_NETWORKS,
} from "../integrations/social-screening/serperSocialDiscovery.js";

export const PLATFORM_ORDER = Object.freeze([
  "instagram",
  "tiktok",
  "linkedin",
  "youtube",
  "x",
  "facebook",
  "threads",
  "reddit",
  "github",
  "pinterest",
  "twitch",
  "snapchat",
  "web",
]);

export const PLATFORM_LABELS = Object.freeze({
  instagram: "Instagram",
  tiktok: "TikTok",
  linkedin: "LinkedIn",
  youtube: "YouTube",
  x: "X / Twitter",
  facebook: "Facebook",
  threads: "Threads",
  reddit: "Reddit",
  github: "GitHub",
  pinterest: "Pinterest",
  twitch: "Twitch",
  snapchat: "Snapchat",
  web: "Web & other",
});

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
 * @param {Array<{ network?: string, kind?: string, title?: string, url?: string, snippet?: string, handle?: string|null }>} [profiles]
 */
export function rankProfiles(profiles = []) {
  const scored = (Array.isArray(profiles) ? profiles : []).map((p, index) => {
    const network = String(p.network ?? "web").toLowerCase();
    const kind = String(p.kind ?? "mention").toLowerCase();
    const title = String(p.title ?? "");
    const snippet = String(p.snippet ?? "");
    const url = String(p.url ?? "");
    let score = 35;
    const orderIdx = PLATFORM_ORDER.indexOf(network);
    if (orderIdx >= 0) score += (PLATFORM_ORDER.length - orderIdx) * 2;
    if (kind === "profile") score += 28;
    else if (kind === "post") score += 12;
    if (/linkedin\.com\/in\//i.test(url)) score += 18;
    if (/instagram\.com\/[^/]+\/?$/i.test(url)) score += 16;
    if (/tiktok\.com\/@[^/]+\/?$/i.test(url)) score += 16;
    if (/profile|official|followers|following|about/i.test(`${title} ${snippet}`)) score += 8;
    if (snippet.length > 40) score += 4;
    return {
      ...p,
      network,
      kind,
      confidence: Math.min(99, score),
      rank: index,
    };
  });
  scored.sort((a, b) => b.confidence - a.confidence || a.rank - b.rank);
  return scored.map(({ rank, ...rest }) => rest);
}

/**
 * Group ranked hits into per-platform sections: profile, posts, mentions.
 * @param {ReturnType<typeof rankProfiles>} profiles
 */
export function organizePlatformSections(profiles = []) {
  /** @type {Map<string, { network: string, label: string, profile: object|null, posts: object[], mentions: object[], all: object[] }>} */
  const byNet = new Map();

  for (const hit of profiles) {
    const network = String(hit.network || "web").toLowerCase();
    if (!byNet.has(network)) {
      byNet.set(network, {
        network,
        label: PLATFORM_LABELS[network] || network,
        profile: null,
        posts: [],
        mentions: [],
        all: [],
      });
    }
    const bucket = byNet.get(network);
    bucket.all.push(hit);
    const kind = String(hit.kind || "mention");
    if (kind === "profile") {
      if (!bucket.profile || (hit.confidence ?? 0) > (bucket.profile.confidence ?? 0)) {
        // Previous best profile demoted into mentions/posts if needed
        if (bucket.profile) bucket.mentions.push(bucket.profile);
        bucket.profile = hit;
      } else {
        bucket.mentions.push(hit);
      }
    } else if (kind === "post") {
      bucket.posts.push(hit);
    } else {
      bucket.mentions.push(hit);
    }
  }

  const ordered = [];
  for (const id of PLATFORM_ORDER) {
    if (byNet.has(id)) ordered.push(byNet.get(id));
  }
  for (const [id, bucket] of byNet) {
    if (!PLATFORM_ORDER.includes(id)) ordered.push(bucket);
  }

  // Sort posts/mentions by confidence within each platform
  for (const bucket of ordered) {
    bucket.posts.sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0));
    bucket.mentions.sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0));
  }

  return ordered;
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
    return { ok: false, reason: "name_required", profiles: [], platforms: [], searches: [] };
  }
  if (!String(serperApiKey ?? "").trim()) {
    return { ok: false, reason: "serper_api_key_missing", profiles: [], platforms: [], searches: [] };
  }

  const discovered = await discoverSocialProfiles({
    subject: {
      name: subjectName || handleClean,
      handles: handleClean ? [handleClean] : [],
    },
    serperApiKey: String(serperApiKey).trim(),
    fetchImpl,
    maxPerNetwork: 10,
    depth: "deep",
    networks: [...SOCIAL_NETWORKS],
  });

  if (!discovered.ok) {
    return {
      ok: false,
      reason: discovered.reason ?? "discovery_failed",
      profiles: [],
      platforms: [],
      searches: discovered.searches ?? [],
    };
  }

  const profiles = rankProfiles(discovered.profiles);
  const platforms = organizePlatformSections(profiles);
  /** @type {Record<string, typeof profiles>} */
  const byNetwork = {};
  for (const p of platforms) {
    byNetwork[p.network] = p.all;
  }

  return {
    ok: true,
    subject: { name: subjectName, handle: handleClean || null },
    profiles,
    platforms,
    byNetwork,
    discoveredHandles: discovered.discoveredHandles ?? [],
    searches: discovered.searches ?? [],
    generatedAt: new Date().toISOString(),
    disclaimer:
      "Public OSINT-style social presence context only. Not an employment, tenant, or FCRA background screen. Profile and post previews come from publicly indexed search results — private accounts and non-indexed content will not appear.",
  };
}
