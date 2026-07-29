/**
 * Public Social Checker — deep multi-platform presence discovery.
 * Uses Serper discovery only (not the full FCRA screening pipeline).
 *
 * Display order per platform: profile → their posts → tags → mentions.
 * Hard rule: never show content that does not clearly involve the subject.
 */
import {
  discoverSocialProfiles,
  SOCIAL_NETWORKS,
  isNoiseUrl,
  nameMatchesSubject,
  isDirectMention,
  isDirectTag,
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

function normalizeHandleList(handles = []) {
  return (Array.isArray(handles) ? handles : [])
    .map((h) => String(h).replace(/^@/, "").trim().toLowerCase())
    .filter((h) => h.length >= 2);
}

/**
 * Keep only: their profile, posts they authored, @tags of them, or clear name mentions.
 * Drops Serper OCR roster ghosts and any hit without a subject signal.
 */
export function filterSubjectRelevant(profiles = [], subject = {}) {
  const name = String(subject.name ?? "").trim();
  const handles = normalizeHandleList(subject.handles);
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

    if (looksLikeRosterOcrPollution(snippet, name) || looksLikeRosterOcrPollution(title, name)) {
      // Still allow if title is a clear name mention / tag (not OCR junk)
      if (!nameMatchesSubject(title, name) && !isDirectTag({ title, snippet, url, handles: handleList })) {
        continue;
      }
      if (looksLikeRosterOcrPollution(snippet, name) && !nameMatchesSubject(title, name)) {
        continue;
      }
    }

    if (kindIn === "profile") {
      if (!profileLooksLikeSubject({ title, snippet, url, name, handles: handleList })) continue;
      out.push({ ...hit, kind: "profile", relation: "own" });
      continue;
    }

    const own = hit.relation === "own" || isLikelyOwnPost({
      title,
      snippet,
      url,
      name,
      handle: handle || handleList[0] || "",
    });
    if (own && (kindIn === "post" || hit.relation === "own")) {
      const subjectSignal = (handle && handleSet.has(handle))
        || handleList.some((h) => url.toLowerCase().includes(`/${h}/`) || url.toLowerCase().includes(`/@${h}`))
        || isLikelyOwnPost({ title, snippet, url, name, handle: handle || handleList[0] || "" });
      if (!subjectSignal) continue;
      out.push({ ...hit, kind: "post", relation: "own" });
      continue;
    }

    if (isDirectTag({ title, snippet, url, handles: handleList }) || kindIn === "tag" || hit.relation === "tagged") {
      out.push({ ...hit, kind: "tag", relation: "tagged" });
      continue;
    }

    if (isDirectMention({ title, snippet, name, handles: handleList })) {
      out.push({ ...hit, kind: "mention", relation: "mentioned" });
    }
  }

  return out;
}

export function rankProfiles(profiles = [], subject = {}) {
  const name = String(subject.name ?? "").trim();
  const handles = new Set(normalizeHandleList(subject.handles));
  const scored = (Array.isArray(profiles) ? profiles : []).map((p, index) => {
    const network = String(p.network ?? "web").toLowerCase();
    const kind = String(p.kind ?? "mention").toLowerCase();
    const title = String(p.title ?? "");
    const url = String(p.url ?? "");
    const handle = String(p.handle ?? "").toLowerCase();
    let score = 40;
    const orderIdx = PLATFORM_ORDER.indexOf(network);
    if (orderIdx >= 0) score += (PLATFORM_ORDER.length - orderIdx);
    if (kind === "profile") score += 35;
    else if (kind === "post" && p.relation === "own") score += 20;
    else if (kind === "tag") score += 14;
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
 * Group ranked hits: profile, posts, tags, mentions.
 */
export function organizePlatformSections(profiles = []) {
  /** @type {Map<string, { network: string, label: string, profile: object|null, posts: object[], tags: object[], mentions: object[], all: object[] }>} */
  const byNet = new Map();

  for (const hit of profiles) {
    const network = String(hit.network || "web").toLowerCase();
    if (!byNet.has(network)) {
      byNet.set(network, {
        network,
        label: PLATFORM_LABELS[network] || network,
        profile: null,
        posts: [],
        tags: [],
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
    } else if (kind === "tag" || hit.relation === "tagged") {
      bucket.tags.push(hit);
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
    bucket.tags.sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0));
    bucket.mentions.sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0));
  }

  return ordered.filter(
    (b) => b.profile || b.posts.length || b.tags.length || b.mentions.length,
  );
}

/**
 * @param {{
 *   name?: string,
 *   handle?: string,
 *   handlesByPlatform?: Record<string, string>,
 *   serperApiKey?: string,
 *   fetchImpl?: typeof fetch,
 * }} [opts]
 */
export async function runPublicSocialCheck({
  name,
  handle = "",
  handlesByPlatform = null,
  serperApiKey = process.env.SERPER_API_KEY,
  fetchImpl = globalThis.fetch?.bind(globalThis),
} = {}) {
  const subjectName = String(name ?? "").trim();
  const handleClean = String(handle ?? "").trim().replace(/^@/, "");
  /** @type {Record<string, string>} */
  const byPlatform = {};
  if (handlesByPlatform && typeof handlesByPlatform === "object") {
    for (const [network, value] of Object.entries(handlesByPlatform)) {
      const h = String(value ?? "").trim().replace(/^@/, "");
      if (h) byPlatform[String(network).toLowerCase()] = h;
    }
  }
  if (handleClean && !Object.keys(byPlatform).length) {
    // Legacy single-handle field — do not invent per-network; still seed discovery
  }

  const flatHandles = [
    ...Object.values(byPlatform),
    ...(handleClean ? [handleClean] : []),
  ];
  const uniqueHandles = [...new Set(flatHandles.map((h) => h.toLowerCase()))];

  if (!subjectName && uniqueHandles.length === 0) {
    return { ok: false, reason: "name_required", profiles: [], platforms: [], searches: [] };
  }
  if (!String(serperApiKey ?? "").trim()) {
    return { ok: false, reason: "serper_api_key_missing", profiles: [], platforms: [], searches: [] };
  }

  const subject = {
    name: subjectName || uniqueHandles[0] || "",
    handles: uniqueHandles,
    handlesByNetwork: byPlatform,
    handlesByPlatform: byPlatform,
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
      ...uniqueHandles,
      ...(discovered.discoveredHandles ?? []),
    ],
  });
  const profiles = rankProfiles(relevant, {
    name: subjectName,
    handles: [
      ...uniqueHandles,
      ...(discovered.discoveredHandles ?? []),
    ],
  });
  const platforms = organizePlatformSections(profiles);

  return {
    ok: true,
    subject: {
      name: subjectName,
      handle: handleClean || uniqueHandles[0] || null,
      handlesByPlatform: byPlatform,
    },
    profiles,
    platforms,
    discoveredHandles: discovered.discoveredHandles ?? [],
    searches: discovered.searches ?? [],
    generatedAt: new Date().toISOString(),
    disclaimer:
      "Public OSINT-style social presence only. Not an employment or FCRA background screen. Only the subject's profile, their own posts, @tags of them, and clear name mentions are shown — unrelated results are dropped.",
  };
}
