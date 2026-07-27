/**
 * Public Social Checker — deep multi-platform presence discovery.
 * Uses Serper discovery only (not the full FCRA screening pipeline).
 *
 * Display order per platform: profile → their posts → direct tags/mentions.
 */
import {
  discoverSocialProfiles,
  SOCIAL_NETWORKS,
  isNoiseUrl,
  nameMatchesSubject,
  isDirectMention,
  isLikelyOwnPost,
  profileLooksLikeSubject,
  looksLikeRosterOcrPollution,
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
 * Keep only: their profile, posts they authored, or posts that directly tag/mention them.
 * Drops Serper OCR roster ghosts (e.g. "LEO PIANDES (A) NICK DEMIO (A)" on unrelated reels).
 * @param {object[]} profiles
 * @param {{ name?: string, handles?: string[] }} subject
 */
export function filterSubjectRelevant(profiles = [], subject = {}) {
  const name = String(subject.name ?? "").trim();
  const handles = (Array.isArray(subject.handles) ? subject.handles : [])
    .map((h) => String(h).replace(/^@/, "").toLowerCase())
    .filter(Boolean);
  const handleSet = new Set(handles);

  for (const hit of profiles) {
    if (String(hit.kind) !== "profile") continue;
    if (isNoiseUrl(hit.url)) continue;
    if (profileLooksLikeSubject({
      title: hit.title,
      snippet: hit.snippet,
      url: hit.url,
      name,
      handles,
    }) && hit.handle) {
      handleSet.add(String(hit.handle).toLowerCase());
    }
  }

  const handleList = [...handleSet];
  const out = [];

  for (const hit of profiles) {
    if (isNoiseUrl(hit.url)) continue;
    const title = String(hit.title ?? "");
    const snippet = String(hit.snippet ?? "");
    const url = String(hit.url ?? "");
    const handle = String(hit.handle ?? "").toLowerCase();
    const kindIn = String(hit.kind || "mention");

    if (looksLikeRosterOcrPollution(snippet, name) && !nameMatchesSubject(title, name)) {
      continue;
    }

    // Profile: must look like the subject
    if (kindIn === "profile") {
      if (!profileLooksLikeSubject({ title, snippet, url, name, handles: handleList })) continue;
      out.push({ ...hit, kind: "profile", relation: "own" });
      continue;
    }

    // Own posts (already tagged by discovery, or heuristic)
    const own = hit.relation === "own" || isLikelyOwnPost({
      title,
      snippet,
      url,
      name,
      handle: handle || handleList[0] || "",
    });
    if (own && (kindIn === "post" || hit.relation === "own")) {
      // Still require some subject signal so random site:handle crawl junk doesn't slip in
      const subjectSignal = (handle && handleSet.has(handle))
        || handleList.some((h) => url.toLowerCase().includes(`/${h}/`) || url.toLowerCase().includes(`/@${h}`))
        || isLikelyOwnPost({ title, snippet, url, name, handle: handle || handleList[0] || "" });
      if (!subjectSignal) continue;
      out.push({ ...hit, kind: "post", relation: "own" });
      continue;
    }

    // Mentions: @tag or name in title / clear direct mention — never OCR ghosts
    if (isDirectMention({ title, snippet, name, handles: handleList })) {
      out.push({ ...hit, kind: "mention", relation: "mentioned" });
    }
  }

  return out;
}

/**
 * @param {Array<{ network?: string, kind?: string, title?: string, url?: string, snippet?: string, handle?: string|null, relation?: string }>} [profiles]
 * @param {{ name?: string, handles?: string[] }} [subject]
 */
export function rankProfiles(profiles = [], subject = {}) {
  const name = String(subject.name ?? "").trim();
  const handles = new Set(
    (Array.isArray(subject.handles) ? subject.handles : [])
      .map((h) => String(h).replace(/^@/, "").toLowerCase())
      .filter(Boolean),
  );
  const scored = (Array.isArray(profiles) ? profiles : []).map((p, index) => {
    const network = String(p.network ?? "web").toLowerCase();
    const kind = String(p.kind ?? "mention").toLowerCase();
    const title = String(p.title ?? "");
    const snippet = String(p.snippet ?? "");
    const url = String(p.url ?? "");
    const handle = String(p.handle ?? "").toLowerCase();
    let score = 40;
    const orderIdx = PLATFORM_ORDER.indexOf(network);
    if (orderIdx >= 0) score += (PLATFORM_ORDER.length - orderIdx);
    if (kind === "profile") score += 35;
    else if (kind === "post" && p.relation === "own") score += 20;
    else if (kind === "mention") score += 8;
    if (name && nameMatchesSubject(title, name)) score += 22;
    if (handle && handles.has(handle)) score += 18;
    if (/linkedin\.com\/in\//i.test(url)) score += 12;
    if (/instagram\.com\/[^/]+\/?$/i.test(url)) score += 12;
    if (/tiktok\.com\/@[^/]+\/?$/i.test(url)) score += 12;
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
 * Empty platforms are dropped.
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
        if (bucket.profile) bucket.mentions.push(bucket.profile);
        bucket.profile = hit;
      } else {
        bucket.mentions.push(hit);
      }
    } else if (kind === "post" && hit.relation === "own") {
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

  for (const bucket of ordered) {
    bucket.posts.sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0));
    bucket.mentions.sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0));
  }

  return ordered.filter((b) => b.profile || b.posts.length || b.mentions.length);
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

  const subject = {
    name: subjectName || handleClean,
    handles: handleClean ? [handleClean] : [],
  };

  const discovered = await discoverSocialProfiles({
    subject,
    serperApiKey: String(serperApiKey).trim(),
    fetchImpl,
    maxPerNetwork: 6,
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

  const relevant = filterSubjectRelevant(discovered.profiles, {
    name: subjectName,
    handles: [
      ...subject.handles,
      ...(discovered.discoveredHandles ?? []),
    ],
  });
  const profiles = rankProfiles(relevant, {
    name: subjectName,
    handles: [
      ...subject.handles,
      ...(discovered.discoveredHandles ?? []),
    ],
  });
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
      "Public OSINT-style social presence context only. Not an employment, tenant, or FCRA background screen. Only the subject's profile, their own posts, and posts that directly tag or mention them are shown.",
  };
}
