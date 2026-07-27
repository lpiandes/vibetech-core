/**
 * Serper Google search — discover public social profiles / posts for a subject.
 * Used by tenant social screening (basic) and public Social Checker (deep).
 */

export const SOCIAL_NETWORKS = Object.freeze([
  "linkedin",
  "instagram",
  "tiktok",
  "youtube",
  "x",
  "facebook",
  "threads",
  "reddit",
  "github",
  "pinterest",
  "twitch",
  "snapchat",
]);

/** Basic screening: one profile-oriented query per core network. */
const BASIC_NETWORK_QUERIES = Object.freeze([
  { network: "linkedin", query: (name) => `"${name}" site:linkedin.com/in` },
  { network: "x", query: (name) => `"${name}" (site:x.com OR site:twitter.com)` },
  { network: "instagram", query: (name) => `"${name}" site:instagram.com` },
  { network: "facebook", query: (name) => `"${name}" site:facebook.com` },
  { network: "tiktok", query: (name) => `"${name}" site:tiktok.com` },
  { network: "youtube", query: (name) => `"${name}" site:youtube.com` },
]);

/**
 * Deep Social Checker: profile + posts/mentions queries across many platforms.
 * Each entry may define profileQueries and contentQueries (functions of name/handle).
 */
const DEEP_NETWORK_SPECS = Object.freeze([
  {
    network: "linkedin",
    profileQueries: (name, handle) => [
      `"${name}" site:linkedin.com/in`,
      handle ? `"${handle}" site:linkedin.com/in` : null,
    ].filter(Boolean),
    contentQueries: (name, handle) => [
      `"${name}" (site:linkedin.com/posts OR site:linkedin.com/feed OR site:linkedin.com/pulse)`,
      handle ? `"${handle}" site:linkedin.com/posts` : null,
    ].filter(Boolean),
  },
  {
    network: "instagram",
    profileQueries: (name, handle) => [
      `"${name}" site:instagram.com -inurl:/p/ -inurl:/reel/ -inurl:/tv/`,
      handle ? `site:instagram.com/${handle}` : null,
      handle ? `"@${handle}" site:instagram.com` : null,
    ].filter(Boolean),
    contentQueries: (name, handle) => [
      `"${name}" (site:instagram.com/p OR site:instagram.com/reel OR site:instagram.com/tv)`,
      handle ? `"${handle}" (site:instagram.com/p OR site:instagram.com/reel)` : null,
    ].filter(Boolean),
  },
  {
    network: "tiktok",
    profileQueries: (name, handle) => [
      `"${name}" site:tiktok.com/@`,
      handle ? `site:tiktok.com/@${handle}` : null,
    ].filter(Boolean),
    contentQueries: (name, handle) => [
      `"${name}" site:tiktok.com/video`,
      handle ? `"${handle}" site:tiktok.com/video` : null,
    ].filter(Boolean),
  },
  {
    network: "youtube",
    profileQueries: (name, handle) => [
      `"${name}" (site:youtube.com/@ OR site:youtube.com/channel OR site:youtube.com/c/ OR site:youtube.com/user)`,
      handle ? `site:youtube.com/@${handle}` : null,
    ].filter(Boolean),
    contentQueries: (name, handle) => [
      `"${name}" (site:youtube.com/watch OR site:youtu.be OR site:youtube.com/shorts)`,
      handle ? `"${handle}" site:youtube.com/watch` : null,
    ].filter(Boolean),
  },
  {
    network: "x",
    profileQueries: (name, handle) => [
      `"${name}" (site:x.com OR site:twitter.com) -inurl:/status/`,
      handle ? `(site:x.com/${handle} OR site:twitter.com/${handle})` : null,
    ].filter(Boolean),
    contentQueries: (name, handle) => [
      `"${name}" (site:x.com/status OR site:twitter.com/status)`,
      handle ? `"${handle}" (site:x.com/status OR site:twitter.com/status)` : null,
    ].filter(Boolean),
  },
  {
    network: "facebook",
    profileQueries: (name, handle) => [
      `"${name}" (site:facebook.com/people OR site:facebook.com/profile.php OR site:facebook.com/)`,
      handle ? `site:facebook.com/${handle}` : null,
    ].filter(Boolean),
    contentQueries: (name, handle) => [
      `"${name}" (site:facebook.com/posts OR site:facebook.com/videos OR site:facebook.com/watch OR site:facebook.com/photo)`,
      handle ? `"${handle}" site:facebook.com/posts` : null,
    ].filter(Boolean),
  },
  {
    network: "threads",
    profileQueries: (name, handle) => [
      `"${name}" site:threads.net`,
      handle ? `site:threads.net/@${handle}` : null,
    ].filter(Boolean),
    contentQueries: (name, handle) => [
      `"${name}" site:threads.net/post`,
      handle ? `"${handle}" site:threads.net` : null,
    ].filter(Boolean),
  },
  {
    network: "reddit",
    profileQueries: (name, handle) => [
      `"${name}" site:reddit.com/user`,
      handle ? `site:reddit.com/user/${handle}` : null,
    ].filter(Boolean),
    contentQueries: (name, handle) => [
      `"${name}" (site:reddit.com/r OR site:reddit.com/comments)`,
      handle ? `"${handle}" site:reddit.com` : null,
    ].filter(Boolean),
  },
  {
    network: "github",
    profileQueries: (name, handle) => [
      `"${name}" site:github.com -inurl:/issues -inurl:/pull`,
      handle ? `site:github.com/${handle}` : null,
    ].filter(Boolean),
    contentQueries: (name, handle) => [
      `"${name}" (site:github.com/*/issues OR site:github.com/*/pull OR site:gist.github.com)`,
      handle ? `"${handle}" site:github.com` : null,
    ].filter(Boolean),
  },
  {
    network: "pinterest",
    profileQueries: (name, handle) => [
      `"${name}" site:pinterest.com`,
      handle ? `site:pinterest.com/${handle}` : null,
    ].filter(Boolean),
    contentQueries: (name, handle) => [
      `"${name}" (site:pinterest.com/pin OR site:pinterest.com/idea)`,
    ].filter(Boolean),
  },
  {
    network: "twitch",
    profileQueries: (name, handle) => [
      `"${name}" site:twitch.tv`,
      handle ? `site:twitch.tv/${handle}` : null,
    ].filter(Boolean),
    contentQueries: (name, handle) => [
      `"${name}" (site:twitch.tv/videos OR site:twitch.tv/clip)`,
    ].filter(Boolean),
  },
  {
    network: "snapchat",
    profileQueries: (name, handle) => [
      `"${name}" (site:snapchat.com/add OR site:snapchat.com/@)`,
      handle ? `site:snapchat.com/add/${handle}` : null,
    ].filter(Boolean),
    contentQueries: (name) => [
      `"${name}" site:snapchat.com`,
    ],
  },
]);

export function guessNetwork(url) {
  const u = String(url).toLowerCase();
  if (u.includes("linkedin.com")) return "linkedin";
  if (u.includes("instagram.com")) return "instagram";
  if (u.includes("tiktok.com")) return "tiktok";
  if (u.includes("youtube.com") || u.includes("youtu.be")) return "youtube";
  if (u.includes("x.com") || u.includes("twitter.com")) return "x";
  if (u.includes("facebook.com") || u.includes("fb.com") || u.includes("fb.watch")) return "facebook";
  if (u.includes("threads.net")) return "threads";
  if (u.includes("reddit.com")) return "reddit";
  if (u.includes("github.com") || u.includes("gist.github.com")) return "github";
  if (u.includes("pinterest.com") || u.includes("pin.it")) return "pinterest";
  if (u.includes("twitch.tv")) return "twitch";
  if (u.includes("snapchat.com")) return "snapchat";
  return "web";
}

/**
 * Classify a hit as profile | post | mention for UI grouping.
 */
export function classifyHitKind(url, title = "", snippet = "", preferredKind = null) {
  if (preferredKind === "profile" || preferredKind === "post" || preferredKind === "mention") {
    return preferredKind;
  }
  const u = String(url).toLowerCase();
  const blob = `${title} ${snippet}`.toLowerCase();

  // Explicit post/content URL shapes
  if (
    /\/(p|reel|tv|reels)\//i.test(u)
    || /\/status\//i.test(u)
    || /\/posts?\//i.test(u)
    || /\/video\//i.test(u)
    || /\/watch/i.test(u)
    || /youtu\.be\//i.test(u)
    || /\/shorts\//i.test(u)
    || /\/pin\//i.test(u)
    || /\/comments?\//i.test(u)
    || /\/clip\//i.test(u)
    || /\/photos?\//i.test(u)
    || /\/videos?\//i.test(u)
    || /\/pulse\//i.test(u)
  ) {
    return "post";
  }

  // Profile-like URL shapes
  if (
    /linkedin\.com\/in\//i.test(u)
    || /instagram\.com\/[^/]+\/?$/i.test(u)
    || /tiktok\.com\/@[^/]+\/?$/i.test(u)
    || /(?:x|twitter)\.com\/[^/]+\/?$/i.test(u)
    || /youtube\.com\/(@|channel\/|c\/|user\/)/i.test(u)
    || /threads\.net\/@[^/]+\/?$/i.test(u)
    || /reddit\.com\/user\//i.test(u)
    || /github\.com\/[^/]+\/?$/i.test(u)
    || /twitch\.tv\/[^/]+\/?$/i.test(u)
    || /snapchat\.com\/(add|@)/i.test(u)
    || /facebook\.com\/(people\/|profile\.php)/i.test(u)
  ) {
    return "profile";
  }

  if (/profile|official account|followers|following/i.test(blob)) return "profile";
  return "mention";
}

export function extractHandleFromUrl(url) {
  const u = String(url ?? "");
  const patterns = [
    /instagram\.com\/([A-Za-z0-9._]+)\/?(?:\?|$)/i,
    /tiktok\.com\/@([A-Za-z0-9._]+)\/?/i,
    /(?:x|twitter)\.com\/([A-Za-z0-9_]+)\/?(?:\?|$)/i,
    /threads\.net\/@([A-Za-z0-9._]+)\/?/i,
    /reddit\.com\/user\/([A-Za-z0-9_-]+)\/?/i,
    /github\.com\/([A-Za-z0-9_-]+)\/?$/i,
    /youtube\.com\/@([A-Za-z0-9._-]+)\/?/i,
    /twitch\.tv\/([A-Za-z0-9_]+)\/?$/i,
    /snapchat\.com\/add\/([A-Za-z0-9._-]+)\/?/i,
    /linkedin\.com\/in\/([A-Za-z0-9_-]+)\/?/i,
  ];
  for (const re of patterns) {
    const m = u.match(re);
    if (m?.[1] && !["p", "reel", "reels", "tv", "status", "posts", "video", "watch", "shorts", "photo", "photos", "videos", "share", "explore"].includes(m[1].toLowerCase())) {
      return m[1];
    }
  }
  return null;
}

export async function discoverSocialProfiles({
  subject = {},
  serperApiKey,
  networks = null,
  fetchImpl = globalThis.fetch?.bind(globalThis),
  maxPerNetwork = 3,
  depth = "basic",
} = {}) {
  const name = String(subject.name ?? "").trim();
  const handles = Array.isArray(subject.handles)
    ? subject.handles.map(String).filter(Boolean)
    : [];
  if (!serperApiKey) {
    return { ok: false, reason: "serper_api_key_missing", profiles: [], searches: [] };
  }
  if (!name && handles.length === 0) {
    return { ok: false, reason: "subject_name_required", profiles: [], searches: [] };
  }
  if (typeof fetchImpl !== "function") {
    return { ok: false, reason: "fetch_unavailable", profiles: [], searches: [] };
  }

  if (depth === "deep") {
    return discoverDeepSocialPresence({
      name,
      handles,
      serperApiKey,
      networks,
      fetchImpl,
      maxPerNetwork: Math.max(maxPerNetwork, 8),
    });
  }

  const wanted = Array.isArray(networks) && networks.length
    ? BASIC_NETWORK_QUERIES.filter((n) => networks.map(String).map((x) => x.toLowerCase()).includes(n.network))
    : BASIC_NETWORK_QUERIES;

  const searches = [];
  const profiles = [];
  const seen = new Set();

  for (const handle of handles.slice(0, 6)) {
    const q = String(handle).replace(/^@/, "");
    searches.push({ network: "handle", query: q });
    const rows = await serperSearch({
      query: q,
      apiKey: serperApiKey,
      fetchImpl,
      num: 5,
    });
    for (const row of rows.slice(0, maxPerNetwork)) {
      pushHit(profiles, seen, row, guessNetwork(row.link), "mention");
    }
  }

  if (name) {
    for (const entry of wanted) {
      const query = entry.query(name);
      searches.push({ network: entry.network, query });
      const rows = await serperSearch({
        query,
        apiKey: serperApiKey,
        fetchImpl,
        num: maxPerNetwork,
      });
      for (const row of rows) {
        pushHit(profiles, seen, row, entry.network, null);
      }
    }
  }

  return { ok: true, profiles, searches };
}

async function discoverDeepSocialPresence({
  name,
  handles,
  serperApiKey,
  networks,
  fetchImpl,
  maxPerNetwork,
}) {
  const handleSeed = handles.map((h) => String(h).replace(/^@/, "")).filter(Boolean);
  const primaryHandle = handleSeed[0] || "";
  const wanted = Array.isArray(networks) && networks.length
    ? DEEP_NETWORK_SPECS.filter((n) => networks.map(String).map((x) => x.toLowerCase()).includes(n.network))
    : DEEP_NETWORK_SPECS;

  const searches = [];
  const profiles = [];
  const seen = new Set();
  const discoveredHandles = new Set(handleSeed.map((h) => h.toLowerCase()));

  async function runQuery(network, query, preferredKind, num = maxPerNetwork) {
    if (!query) return;
    searches.push({ network, query, kind: preferredKind });
    const rows = await serperSearch({
      query,
      apiKey: serperApiKey,
      fetchImpl,
      num,
    });
    for (const row of rows) {
      const hit = pushHit(profiles, seen, row, network, preferredKind);
      if (!hit) continue;
      const extracted = extractHandleFromUrl(hit.url);
      if (extracted) discoveredHandles.add(extracted.toLowerCase());
    }
  }

  // Broad open-web sweep first (catch news, school, sports, blogs, etc.)
  if (name) {
    await runQuery("web", `"${name}"`, "mention", 10);
  }

  // Run each platform's profile + content queries in parallel batches
  for (const spec of wanted) {
    const profileQs = spec.profileQueries(name || primaryHandle, primaryHandle) || [];
    const contentQs = spec.contentQueries(name || primaryHandle, primaryHandle) || [];
    await Promise.all([
      ...profileQs.map((q) => runQuery(spec.network, q, "profile", maxPerNetwork)),
      ...contentQs.map((q) => runQuery(spec.network, q, "post", maxPerNetwork)),
    ]);
  }

  // Follow-up: for discovered handles, pull more profile + content hits (batched)
  const followHandles = [...discoveredHandles].slice(0, 6);
  const followJobs = [];
  for (const handle of followHandles) {
    for (const spec of wanted) {
      const profileQs = (spec.profileQueries("", handle) || []).slice(0, 1);
      const contentQs = (spec.contentQueries("", handle) || []).slice(0, 1);
      for (const q of profileQs) followJobs.push(runQuery(spec.network, q, "profile", 5));
      for (const q of contentQs) followJobs.push(runQuery(spec.network, q, "post", 5));
    }
  }
  // Cap concurrency bursts to avoid Serper rate spikes
  for (let i = 0; i < followJobs.length; i += 8) {
    await Promise.all(followJobs.slice(i, i + 8));
  }

  return {
    ok: true,
    profiles,
    searches,
    discoveredHandles: [...discoveredHandles],
  };
}

function pushHit(profiles, seen, row, networkHint, preferredKind) {
  const url = String(row?.link ?? "").trim();
  if (!url || seen.has(url)) return null;
  seen.add(url);
  const network = networkHint && networkHint !== "handle" ? networkHint : guessNetwork(url);
  const title = String(row?.title ?? "");
  const snippet = String(row?.snippet ?? "");
  const kind = classifyHitKind(url, title, snippet, preferredKind);
  const hit = {
    network,
    kind,
    title,
    url,
    snippet,
    handle: extractHandleFromUrl(url),
  };
  profiles.push(hit);
  return hit;
}

async function serperSearch({ query, apiKey, fetchImpl, num = 5 }) {
  const res = await fetchImpl("https://google.serper.dev/search", {
    method: "POST",
    headers: {
      "X-API-KEY": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ q: query, num }),
  });
  if (!res.ok) {
    return [];
  }
  const data = await res.json().catch(() => ({}));
  return Array.isArray(data.organic) ? data.organic : [];
}

// Backward-compatible alias used by older screening imports
const NETWORK_QUERIES = BASIC_NETWORK_QUERIES;
export { NETWORK_QUERIES, serperSearch };
