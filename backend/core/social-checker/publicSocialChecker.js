/**
 * Public Social Checker — deep multi-platform presence discovery.
 * Uses Serper discovery only (not the full FCRA screening pipeline).
 */
import {
  discoverSocialProfiles,
  SOCIAL_NETWORKS,
  isNoiseUrl,
  nameMatchesSubject,
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
 * Keep only hits about this subject: their profile, their posts, or posts that mention/tag them.
 * @param {object[]} profiles
 * @param {{ name?: string, handles?: string[] }} subject
 */
export function filterSubjectRelevant(profiles = [], subject = {}) {
  const name = String(subject.name ?? "").trim();
  const handles = (Array.isArray(subject.handles) ? subject.handles : [])
    .map((h) => String(h).replace(/^@/, "").toLowerCase())
    .filter(Boolean);
  const handleSet = new Set(handles);

  // First pass: collect trusted profile handles that clearly belong to the subject
  for (const hit of profiles) {
    if (String(hit.kind) !== "profile") continue;
    if (isNoiseUrl(hit.url)) continue;
    const blob = `${hit.title ?? ""} ${hit.snippet ?? ""}`;
    if (name && nameMatchesSubject(blob, name) && hit.handle) {
      handleSet.add(String(hit.handle).toLowerCase());
    }
  }

  const out = [];
  for (const hit of profiles) {
    if (isNoiseUrl(hit.url)) continue;
    const title = String(hit.title ?? "");
    const snippet = String(hit.snippet ?? "");
    const url = String(hit.url ?? "");
    const blob = `${title} ${snippet} ${url}`.toLowerCase();
    const handle = String(hit.handle ?? "").toLowerCase();
    const named = name ? nameMatchesSubject(`${title} ${snippet}`, name) : false;
    const handleHit = handle && handleSet.has(handle);
    const handleInText = [...handleSet].some((h) => h.length >= 3 && blob.includes(h.toLowerCase()));

    // Must be about the subject somehow
    if (!named && !handleHit && !handleInText) continue;

    let kind = String(hit.kind || "mention");
    // Own content: profile URL or post under a trusted handle
    const ownContent = handleHit || (handle && handleSet.has(handle));
    if (kind === "profile" && !named && !handleHit) continue;
    if (kind === "profile" && named) {
      // ok
    } else if (kind === "post" && ownContent) {
      kind = "post"; // their own post
    } else if (named || handleInText) {
      kind = kind === "profile" ? "profile" : "mention"; // tagged / mentioned
    } else {
      continue;
    }

    out.push({
      ...hit,
      kind,
      relation: ownContent && kind !== "mention" ? "own" : "mentioned",
    });
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
    if (kind === "profile") score += 30;
    else if (kind === "post" && p.relation === "own") score += 18;
    else if (kind === "mention" || kind === "post") score += 10;
    if (name && nameMatchesSubject(`${title} ${snippet}`, name)) score += 20;
    if (handle && handles.has(handle)) score += 15;
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
    } else if (kind === "post") {
      // Someone else's post that mentions them
      bucket.mentions.push(hit);
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

  // Drop platforms with nothing useful
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
    maxPerNetwork: 8,
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
      "Public OSINT-style social presence context only. Not an employment, tenant, or FCRA background screen. Only profiles, posts, and mentions that match the searched name or verified handles are shown.",
  };
}
