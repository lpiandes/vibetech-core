/**
 * Serper Google search — discover public social profiles / posts for a subject.
 * Used by tenant social screening (basic) and public Social Checker (deep).
 *
 * Deep mode is intentionally profile-first:
 *   1) resolve the person's profile on each platform
 *   2) find posts from that profile
 *   3) find posts that @tag or directly mention them
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
 */
const DEEP_NETWORK_SPECS = Object.freeze([
  {
    network: "linkedin",
    profileQueries: (name, handle) => [
      `"${name}" site:linkedin.com/in`,
      `"${name}" (site:linkedin.com/in OR site:linkedin.com/pub)`,
      handle ? `site:linkedin.com/in/${handle}` : null,
    ].filter(Boolean),
    ownPostQueries: (name, handle) => [
      handle ? `"${name}" site:linkedin.com/in/${handle}` : null,
      handle ? `site:linkedin.com/in/${handle} (posts OR activity)` : null,
    ].filter(Boolean),
    mentionQueries: (name, handle) => [
      `"${name}" (site:linkedin.com/posts OR site:linkedin.com/pulse)`,
      `"${name}" site:linkedin.com`,
      handle ? `"@${handle}" site:linkedin.com` : null,
    ].filter(Boolean),
    profileUrl: (handle) => `https://www.linkedin.com/in/${handle}/`,
  },
  {
    network: "instagram",
    profileQueries: (name, handle) => [
      `"${name}" site:instagram.com -inurl:/p/ -inurl:/reel/ -inurl:/tv/ -inurl:/stories/`,
      `"${name}" Instagram profile`,
      `"${name}" site:instagram.com`,
      handle ? `site:instagram.com/${handle}` : null,
    ].filter(Boolean),
    ownPostQueries: (name, handle) => [
      handle ? `site:instagram.com/${handle}` : null,
      handle ? `"${name}" site:instagram.com/${handle}` : null,
      handle ? `"${name}" on Instagram site:instagram.com` : null,
    ].filter(Boolean),
    mentionQueries: (name, handle) => [
      `"${name}" site:instagram.com`,
      `"${name}" (site:instagram.com/p OR site:instagram.com/reel)`,
      handle ? `"@${handle}" site:instagram.com` : null,
      `"${name}" (congratulations OR captain OR tagged OR scored) site:instagram.com`,
    ].filter(Boolean),
    profileUrl: (handle) => `https://www.instagram.com/${handle}/`,
  },
  {
    network: "tiktok",
    profileQueries: (name, handle) => [
      `"${name}" site:tiktok.com/@`,
      handle ? `site:tiktok.com/@${handle}` : null,
    ].filter(Boolean),
    ownPostQueries: (name, handle) => [
      handle ? `site:tiktok.com/@${handle}` : null,
      handle ? `"${name}" site:tiktok.com/@${handle}` : null,
    ].filter(Boolean),
    mentionQueries: (name, handle) => [
      handle ? `"@${handle}" site:tiktok.com` : null,
      handle ? `"tagged" "@${handle}" site:tiktok.com` : null,
      `"${name}" (tagged OR featuring OR "duet with" OR congratulations) site:tiktok.com`,
      `"${name}" site:tiktok.com/video`,
      `"${name}" site:tiktok.com`,
    ].filter(Boolean),
    profileUrl: (handle) => `https://www.tiktok.com/@${handle}`,
  },
  {
    network: "youtube",
    profileQueries: (name, handle) => [
      `"${name}" (site:youtube.com/@ OR site:youtube.com/channel OR site:youtube.com/c/ OR site:youtube.com/user)`,
      handle ? `site:youtube.com/@${handle}` : null,
    ].filter(Boolean),
    ownPostQueries: (name, handle) => [
      handle ? `site:youtube.com/@${handle}` : null,
      handle ? `"${name}" site:youtube.com/@${handle}` : null,
    ].filter(Boolean),
    mentionQueries: (name, handle) => [
      handle ? `"@${handle}" (site:youtube.com/watch OR site:youtu.be)` : null,
      `"${name}" (featuring OR tagged OR "ft." OR mentioned OR highlights) (site:youtube.com/watch OR site:youtube.com/shorts)`,
      `"${name}" (site:youtube.com/watch OR site:youtu.be OR site:youtube.com/shorts)`,
      `"${name}" site:youtube.com`,
    ].filter(Boolean),
    profileUrl: (handle) => `https://www.youtube.com/@${handle}`,
  },
  {
    network: "x",
    profileQueries: (name, handle) => [
      `"${name}" (site:x.com OR site:twitter.com) -inurl:/status/`,
      handle ? `(site:x.com/${handle} OR site:twitter.com/${handle}) -inurl:/status/` : null,
    ].filter(Boolean),
    ownPostQueries: (name, handle) => [
      handle ? `(site:x.com/${handle}/status OR site:twitter.com/${handle}/status)` : null,
      handle ? `from:${handle}` : null,
    ].filter(Boolean),
    mentionQueries: (name, handle) => [
      handle ? `"@${handle}" (site:x.com/status OR site:twitter.com/status)` : null,
      handle ? `"@${handle}" (site:x.com OR site:twitter.com)` : null,
      `"${name}" (tagged OR mentioning OR "shout out" OR congratulations) (site:x.com/status OR site:twitter.com/status)`,
      `"${name}" (site:x.com/status OR site:twitter.com/status)`,
      `"${name}" (site:x.com OR site:twitter.com)`,
    ].filter(Boolean),
    profileUrl: (handle) => `https://x.com/${handle}`,
  },
  {
    network: "facebook",
    profileQueries: (name, handle) => [
      `"${name}" (site:facebook.com/people OR site:facebook.com/profile.php)`,
      handle ? `site:facebook.com/${handle}` : null,
    ].filter(Boolean),
    ownPostQueries: (name, handle) => [
      handle ? `site:facebook.com/${handle}` : null,
    ].filter(Boolean),
    mentionQueries: (name, handle) => [
      handle ? `"@${handle}" site:facebook.com` : null,
      `"${name}" (tagged OR "was tagged" OR with OR congratulations) (site:facebook.com/posts OR site:facebook.com/photos)`,
      `"${name}" (site:facebook.com/posts OR site:facebook.com/photos OR site:facebook.com/watch)`,
      `"${name}" site:facebook.com`,
    ].filter(Boolean),
    profileUrl: (handle) => `https://www.facebook.com/${handle}`,
  },
  {
    network: "threads",
    profileQueries: (name, handle) => [
      `"${name}" site:threads.net/@`,
      handle ? `site:threads.net/@${handle}` : null,
    ].filter(Boolean),
    ownPostQueries: (name, handle) => [
      handle ? `site:threads.net/@${handle}` : null,
    ].filter(Boolean),
    mentionQueries: (name, handle) => [
      handle ? `"@${handle}" site:threads.net` : null,
      `"${name}" site:threads.net/post`,
    ].filter(Boolean),
    profileUrl: (handle) => `https://www.threads.net/@${handle}`,
  },
  {
    network: "reddit",
    profileQueries: (name, handle) => [
      `"${name}" site:reddit.com/user`,
      handle ? `site:reddit.com/user/${handle}` : null,
    ].filter(Boolean),
    ownPostQueries: (name, handle) => [
      handle ? `site:reddit.com/user/${handle}` : null,
    ].filter(Boolean),
    mentionQueries: (name, handle) => [
      handle ? `"u/${handle}" site:reddit.com` : null,
      `"${name}" (site:reddit.com/r OR site:reddit.com/comments)`,
    ].filter(Boolean),
    profileUrl: (handle) => `https://www.reddit.com/user/${handle}/`,
  },
  {
    network: "github",
    profileQueries: (name, handle) => [
      `"${name}" site:github.com -inurl:/issues -inurl:/pull -inurl:/blob`,
      handle ? `site:github.com/${handle}` : null,
    ].filter(Boolean),
    ownPostQueries: (name, handle) => [
      handle ? `site:github.com/${handle}` : null,
    ].filter(Boolean),
    mentionQueries: (name, handle) => [
      handle ? `"@${handle}" site:github.com` : null,
      `"${name}" (site:github.com/*/issues OR site:github.com/*/pull)`,
    ].filter(Boolean),
    profileUrl: (handle) => `https://github.com/${handle}`,
  },
  {
    network: "pinterest",
    profileQueries: (name, handle) => [
      `"${name}" site:pinterest.com -inurl:/pin/`,
      handle ? `site:pinterest.com/${handle}` : null,
    ].filter(Boolean),
    ownPostQueries: (name, handle) => [
      handle ? `site:pinterest.com/${handle}` : null,
    ].filter(Boolean),
    mentionQueries: (name) => [
      `"${name}" site:pinterest.com/pin`,
    ],
    profileUrl: (handle) => `https://www.pinterest.com/${handle}/`,
  },
  {
    network: "twitch",
    profileQueries: (name, handle) => [
      `"${name}" site:twitch.tv -inurl:/videos -inurl:/clip`,
      handle ? `site:twitch.tv/${handle}` : null,
    ].filter(Boolean),
    ownPostQueries: (name, handle) => [
      handle ? `site:twitch.tv/${handle}` : null,
    ].filter(Boolean),
    mentionQueries: (name, handle) => [
      handle ? `"@${handle}" site:twitch.tv` : null,
      `"${name}" (site:twitch.tv/videos OR site:twitch.tv/clip)`,
    ].filter(Boolean),
    profileUrl: (handle) => `https://www.twitch.tv/${handle}`,
  },
  {
    network: "snapchat",
    profileQueries: (name, handle) => [
      `"${name}" (site:snapchat.com/add OR site:snapchat.com/@)`,
      handle ? `site:snapchat.com/add/${handle}` : null,
    ].filter(Boolean),
    ownPostQueries: () => [],
    mentionQueries: (name) => [
      `"${name}" site:snapchat.com`,
    ],
    profileUrl: (handle) => `https://www.snapchat.com/add/${handle}`,
  },
]);

const RESERVED_PATH_HANDLES = new Set([
  "p", "reel", "reels", "tv", "status", "posts", "video", "watch", "shorts",
  "photo", "photos", "videos", "share", "explore", "stories", "accounts",
  "about", "help", "privacy", "directory", "jobs", "ads", "developers",
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
 * URL shape wins over query preference so /reel/ and /p/ never become "profile".
 */
export function classifyHitKind(url, title = "", snippet = "", preferredKind = null) {
  const u = String(url).toLowerCase();
  const blob = `${title} ${snippet}`.toLowerCase();

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
    || /\/activity-/i.test(u)
    || /threads\.net\/post/i.test(u)
  ) {
    return "post";
  }

  if (
    /linkedin\.com\/in\//i.test(u)
    || /instagram\.com\/([a-z0-9._]+)\/?(?:\?|$)/i.test(u)
    || /tiktok\.com\/@[^/]+\/?$/i.test(u)
    || /(?:^|\/\/)(?:www\.)?(?:x|twitter)\.com\/[a-z0-9_]+\/?(?:\?|$)/i.test(u)
    || /youtube\.com\/(@|channel\/|c\/|user\/)/i.test(u)
    || /threads\.net\/@[^/]+\/?$/i.test(u)
    || /reddit\.com\/user\//i.test(u)
    || /github\.com\/[a-z0-9_-]+\/?$/i.test(u)
    || /twitch\.tv\/[a-z0-9_]+\/?$/i.test(u)
    || /snapchat\.com\/(add|@)/i.test(u)
    || /facebook\.com\/(people\/|profile\.php)/i.test(u)
  ) {
    return "profile";
  }

  if (preferredKind === "profile" || preferredKind === "post" || preferredKind === "mention") {
    return preferredKind;
  }
  if (/profile|official account|followers|following/i.test(blob)) return "profile";
  return "mention";
}

/** Generic platform / docs / marketing pages that are never subject-relevant. */
export function isNoiseUrl(url) {
  const u = String(url ?? "").toLowerCase();
  if (!u) return true;
  const noiseHosts = [
    "developers.facebook.com",
    "developers.google.com",
    "developer.x.com",
    "developer.twitter.com",
    "docs.github.com",
    "help.instagram.com",
    "about.instagram.com",
    "newsroom.tiktok.com",
    "forbusiness.snapchat.com",
    "parents.snapchat.com",
    "easylens.snapchat.com",
    "scan.snapchat.com",
    "meetups.twitch.tv",
    "dev.twitch.tv",
    "appeals.twitch.tv",
    "link.twitch.tv",
    "code.facebook.com",
    "ai.facebook.com",
    "music.youtube.com",
    "gist.github.com",
  ];
  if (noiseHosts.some((n) => u.includes(n))) return true;
  if (/^https?:\/\/(www\.)?(instagram|tiktok|facebook|snapchat|pinterest|reddit|youtube|x|twitter)\.com\/?(\?.*)?$/i.test(u)) {
    return true;
  }
  return false;
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
    if (m?.[1] && !RESERVED_PATH_HANDLES.has(m[1].toLowerCase())) {
      return m[1];
    }
  }
  return null;
}

/** True when haystack contains the subject full name (all significant tokens). */
export function nameMatchesSubject(haystack, name) {
  const text = String(haystack ?? "").toLowerCase();
  const tokens = nameTokens(name);
  if (!tokens.length) return false;
  return tokens.every((token) => text.includes(token));
}

function nameTokens(name) {
  return String(name ?? "")
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2);
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Serper/Google often appends OCR roster text like
 * "LEO PIANDES (A) NICK DEMIO (A) NE 10" onto unrelated Instagram posts.
 * That is NOT a real mention of the person.
 */
export function looksLikeRosterOcrPollution(snippet, name) {
  const s = String(snippet ?? "");
  if (!s) return false;
  // Classic hockey/sports lineup OCR: NAME (A) OTHER NAME (A)
  if (/\([AC]\)\s+[A-Z][A-Z .'-]{1,40}\s*\([AC]\)/.test(s)) return true;
  if (/\([AC]\)\s*NE\s*\d+/i.test(s) && nameMatchesSubject(s, name)) return true;
  // Many ALL-CAPS multi-word names jammed together with the subject
  const capsNames = s.match(/\b[A-Z]{2,}(?:\s+[A-Z]{2,})+\b/g) || [];
  if (capsNames.length >= 2 && nameMatchesSubject(s, name) && !nameMatchesSubject(capsNames[0], name)) {
    return true;
  }
  return false;
}

/**
 * Direct @tag / u/handle only (strongest mention signal).
 */
export function isDirectTag({ title = "", snippet = "", url = "", handles = [] } = {}) {
  const blob = `${title} ${snippet} ${url}`;
  const handleList = (Array.isArray(handles) ? handles : [])
    .map((h) => String(h).replace(/^@/, "").trim())
    .filter((h) => h.length >= 2);
  for (const h of handleList) {
    if (new RegExp(`(^|[^A-Za-z0-9_])@${escapeRegex(h)}\\b`, "i").test(blob)) return true;
    if (new RegExp(`\\bu/${escapeRegex(h)}\\b`, "i").test(blob)) return true;
    // Instagram/TikTok tagged-in-URL patterns are rare; keep text-based.
  }
  return false;
}

/**
 * Direct mention / tag only — not polluted snippet ghosts.
 * Accept when:
 *  - @handle appears in title or snippet (tag)
 *  - full name appears in the TITLE (clear headline mention)
 *  - snippet has clear tag language + name, and is not OCR roster junk
 * Never accept "name buried in OCR garbage" alone.
 */
export function isDirectMention({ title = "", snippet = "", name = "", handles = [] } = {}) {
  const t = String(title ?? "");
  const s = String(snippet ?? "");

  if (isDirectTag({ title: t, snippet: s, handles })) return true;

  if (name && nameMatchesSubject(t, name) && !looksLikeRosterOcrPollution(t, name)) {
    return true;
  }

  if (name && nameMatchesSubject(s, name)) {
    if (looksLikeRosterOcrPollution(s, name)) return false;
    // Explicit attribution language near the name — still not bare OCR ghosts
    if (/\b(tagged|was tagged|mention(?:ed|s)?|featuring|congratulat(?:es|ions)?|photo of|shout\s*out|with @|captain|induct(?:ed|ion)|scored|goal|assist|highlight)\b/i.test(s)
      && nameMatchesSubject(s.slice(0, 220), name)) {
      return true;
    }
    return false;
  }

  return false;
}

/**
 * True when the title leads with a different person's name than the one searched,
 * e.g. "Alex Other (@handle) / Posts / X" while searching "Sam Subject".
 * Other people often mention the subject in snippets — that must not claim their profile.
 */
export function titleLeadsWithDifferentPerson(title, name) {
  const t = String(title ?? "").trim();
  const subjectTokens = nameTokens(name);
  if (!subjectTokens.length || !t) return false;

  // "Name Name (@handle)" or "Name Name / Posts" or "Name Name on X"
  const lead = t.match(
    /^([A-Za-z][A-Za-z.'-]*(?:\s+[A-Za-z][A-Za-z.'-]*){1,3})\s*(?:\(|\/|•|·|-|\||on\s+)/i,
  );
  if (!lead?.[1]) return false;
  const leadName = lead[1].trim();
  if (nameTokens(leadName).length < 2) return false;
  if (nameMatchesSubject(leadName, name)) return false;
  // Subject name appears later in the title (e.g. co-headline) — still a different person's profile card
  return true;
}

/**
 * Heuristic: is this post authored by the subject (vs merely about them)?
 */
export function isLikelyOwnPost({ title = "", snippet = "", url = "", name = "", handle = "" } = {}) {
  const t = String(title ?? "");
  const s = String(snippet ?? "");
  const u = String(url ?? "").toLowerCase();
  const h = String(handle ?? "").replace(/^@/, "").toLowerCase();
  const blob = `${t} ${s}`.toLowerCase();

  // Never treat another person's post as the subject's just because the subject is named in the text
  if (name && titleLeadsWithDifferentPerson(t, name)) return false;

  if (h) {
    if (u.includes(`/${h}/`) || u.includes(`/@${h}`)) {
      // URL is under that handle — still reject if title is clearly someone else's name card
      if (name && titleLeadsWithDifferentPerson(t, name)) return false;
      return true;
    }
    if (new RegExp(`${escapeRegex(h)}['']s (profile|post|reel|video|photo)`, "i").test(blob)) return true;
    if (new RegExp(`^@?${escapeRegex(h)}[\\s.•·|:]`, "i").test(t.trim())) {
      if (name && titleLeadsWithDifferentPerson(t, name)) return false;
      return true;
    }
    if (new RegExp(`\\(@?${escapeRegex(h)}\\)`, "i").test(t)) {
      if (name && titleLeadsWithDifferentPerson(t, name)) return false;
      return true;
    }
  }
  if (name && new RegExp(`${escapeRegex(name)}\\s+on\\s+(instagram|tiktok|facebook|linkedin|youtube|x|twitter)`, "i").test(t)) {
    return true;
  }
  return false;
}

/**
 * Profile attribution: title (or user-provided handle) must identify the subject.
 * Never accept a profile just because the snippet mentions the subject (teammate posts).
 */
export function profileLooksLikeSubject({ title = "", snippet = "", url = "", name = "", handles = [] } = {}) {
  const t = String(title ?? "");
  const handle = extractHandleFromUrl(url);
  const provided = new Set(
    (Array.isArray(handles) ? handles : [])
      .map((h) => String(h).replace(/^@/, "").toLowerCase())
      .filter(Boolean),
  );

  if (handle && provided.has(handle.toLowerCase())) {
    // User typed this handle — trust it even if the title is sparse
    return true;
  }

  if (name && titleLeadsWithDifferentPerson(t, name)) return false;

  if (name && nameMatchesSubject(t, name) && !looksLikeRosterOcrPollution(t, name)) {
    return true;
  }

  return false;
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
  const handlesByNetwork = normalizeHandlesByNetwork(subject.handlesByNetwork ?? subject.handlesByPlatform);
  const handles = [
    ...(Array.isArray(subject.handles) ? subject.handles.map(String).filter(Boolean) : []),
    ...Object.values(handlesByNetwork),
  ];
  const uniqueHandles = [...new Set(handles.map((h) => String(h).replace(/^@/, "").trim()).filter(Boolean))];

  if (!serperApiKey) {
    return { ok: false, reason: "serper_api_key_missing", profiles: [], searches: [] };
  }
  if (!name && uniqueHandles.length === 0) {
    return { ok: false, reason: "subject_name_required", profiles: [], searches: [] };
  }
  if (typeof fetchImpl !== "function") {
    return { ok: false, reason: "fetch_unavailable", profiles: [], searches: [] };
  }

  if (depth === "deep") {
    return discoverDeepSocialPresence({
      name,
      handles: uniqueHandles,
      handlesByNetwork,
      serperApiKey,
      networks,
      fetchImpl,
      maxPerNetwork: Math.max(maxPerNetwork, 12),
    });
  }

  const wanted = Array.isArray(networks) && networks.length
    ? BASIC_NETWORK_QUERIES.filter((n) => networks.map(String).map((x) => x.toLowerCase()).includes(n.network))
    : BASIC_NETWORK_QUERIES;

  const searches = [];
  const profiles = [];
  const seen = new Set();

  for (const handle of uniqueHandles.slice(0, 8)) {
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

function normalizeHandlesByNetwork(raw) {
  if (!raw || typeof raw !== "object") return {};
  /** @type {Record<string, string>} */
  const out = {};
  for (const [network, value] of Object.entries(raw)) {
    const h = String(value ?? "").trim().replace(/^@/, "");
    if (!h) continue;
    out[String(network).toLowerCase()] = h;
  }
  return out;
}

/**
 * Profile → own posts → tags/mentions across EVERY requested platform.
 * Always searches by name on all platforms (handles only improve match quality).
 * Runs Serper queries in parallel with a hard budget so the request finishes.
 */
async function discoverDeepSocialPresence({
  name,
  handles,
  handlesByNetwork = {},
  serperApiKey,
  networks,
  fetchImpl,
  maxPerNetwork,
}) {
  const { isSubjectProfile, MAX_SUBJECT_PROFILES_PER_NETWORK } = await import("./subjectIdentity.js");
  const handleSeed = handles.map((h) => String(h).replace(/^@/, "")).filter(Boolean);
  const byNet = handlesByNetwork && typeof handlesByNetwork === "object" ? handlesByNetwork : {};
  const wanted = Array.isArray(networks) && networks.length
    ? DEEP_NETWORK_SPECS.filter((n) => networks.map(String).map((x) => x.toLowerCase()).includes(n.network))
    : DEEP_NETWORK_SPECS;

  const searches = [];
  const profiles = [];
  const seen = new Set();
  /** @type {Map<string, Set<string>>} */
  const trustedByNetwork = new Map();
  const allTrusted = new Set(handleSeed.map((h) => h.toLowerCase()));

  function trustHandle(network, handle) {
    const h = String(handle || "").replace(/^@/, "").trim();
    if (!h || RESERVED_PATH_HANDLES.has(h.toLowerCase())) return;
    if (!trustedByNetwork.has(network)) trustedByNetwork.set(network, new Set());
    trustedByNetwork.get(network).add(h.toLowerCase());
    allTrusted.add(h.toLowerCase());
  }

  for (const [network, handle] of Object.entries(byNet)) {
    trustHandle(network, handle);
  }

  function ensureSynthesizedProfile(network, handle, nameHint) {
    const spec = wanted.find((s) => s.network === network);
    if (!spec?.profileUrl || !handle) return;
    const url = spec.profileUrl(handle);
    if (seen.has(url) || isNoiseUrl(url)) return;
    seen.add(url);
    profiles.push({
      network,
      kind: "profile",
      relation: "own",
      title: nameHint ? `${nameHint} (@${handle})` : `@${handle}`,
      url,
      snippet: "Resolved profile URL for verified handle.",
      handle,
    });
  }

  // Seed typed handles immediately (does not skip other platforms)
  for (const spec of wanted) {
    const seedHandle = byNet[spec.network] || "";
    if (seedHandle) {
      trustHandle(spec.network, seedHandle);
      ensureSynthesizedProfile(spec.network, seedHandle, name);
    }
  }

  /** @type {{ network: string, query: string, preferredKind: string, num: number }[]} */
  const jobs = [];
  const CORE_FIRST = [
    "linkedin", "instagram", "tiktok", "youtube", "x", "facebook", "threads", "reddit", "github",
  ];
  const orderedSpecs = [
    ...CORE_FIRST.map((id) => wanted.find((s) => s.network === id)).filter(Boolean),
    ...wanted.filter((s) => !CORE_FIRST.includes(s.network)),
  ];

  for (const spec of orderedSpecs) {
    const seedHandle = byNet[spec.network] || "";
    const netTrusted = [...(trustedByNetwork.get(spec.network) || [])];
    const primaryHandle = seedHandle || netTrusted[0] || "";

    // ALWAYS search profiles + mentions by name on every platform (handles optional)
    for (const q of (spec.profileQueries(name || primaryHandle, primaryHandle) || []).slice(0, 2)) {
      jobs.push({ network: spec.network, query: q, preferredKind: "profile", num: Math.min(8, maxPerNetwork) });
    }
    for (const q of (spec.mentionQueries?.(name, primaryHandle) || []).slice(0, 3)) {
      jobs.push({ network: spec.network, query: q, preferredKind: "mention", num: Math.min(10, maxPerNetwork) });
    }
    // Own posts only when we have a handle for THIS platform
    for (const handle of netTrusted.slice(0, MAX_SUBJECT_PROFILES_PER_NETWORK)) {
      for (const q of (spec.ownPostQueries?.(name, handle) || []).slice(0, 2)) {
        jobs.push({ network: spec.network, query: q, preferredKind: "post", num: Math.min(8, maxPerNetwork) });
      }
    }
  }

  if (name) {
    for (const q of [
      `"${name}"`,
      `"${name}" (news OR athlete OR player OR student OR captain OR congratulations)`,
      `"${name}" (instagram OR tiktok OR linkedin OR twitter OR facebook)`,
    ]) {
      jobs.push({ network: "web", query: q, preferredKind: "mention", num: 10 });
    }
  }

  // Hard cap — finishes in production time limits while covering every platform
  const cappedJobs = jobs.slice(0, 72);

  async function runPool(list, concurrency, worker) {
    let cursor = 0;
    async function run() {
      while (cursor < list.length) {
        const idx = cursor;
        cursor += 1;
        await worker(list[idx], idx);
      }
    }
    await Promise.all(Array.from({ length: Math.min(concurrency, list.length) || 1 }, () => run()));
  }

  await runPool(cappedJobs, 8, async (job) => {
    if (!job?.query) return;
    searches.push({ network: job.network, query: job.query, kind: job.preferredKind });
    const rows = await serperSearch({
      query: job.query,
      apiKey: serperApiKey,
      fetchImpl,
      num: job.num,
    });
    for (const row of rows) {
      const url = String(row?.link ?? "").trim();
      if (!url || isNoiseUrl(url)) continue;
      pushHit(profiles, seen, row, job.network, job.preferredKind);
    }
  });

  // Classify / drop with the universal identity gate
  const subjectHandles = [...allTrusted];
  for (let i = profiles.length - 1; i >= 0; i -= 1) {
    const hit = profiles[i];
    const title = String(hit.title ?? "");
    const snippet = String(hit.snippet ?? "");
    const url = String(hit.url ?? "");

    if (hit.kind === "profile") {
      if (!isSubjectProfile(hit, { name, handles: subjectHandles })) {
        // Might still be a mention of the subject on someone else's page
        if (isDirectMention({ title, snippet, name, handles: subjectHandles })) {
          hit.kind = "mention";
          hit.relation = "mentioned";
        } else if (isDirectTag({ title, snippet, url, handles: subjectHandles })) {
          hit.kind = "tag";
          hit.relation = "tagged";
        } else {
          profiles.splice(i, 1);
          seen.delete(hit.url);
        }
      } else {
        hit.relation = "own";
        if (hit.handle && extractHandleFromUrl(hit.url) === hit.handle) {
          trustHandle(hit.network, hit.handle);
        }
      }
      continue;
    }

    if (titleLeadsWithDifferentPerson(title, name)) {
      if (isDirectTag({ title, snippet, url, handles: [...allTrusted] })) {
        hit.kind = "tag";
        hit.relation = "tagged";
      } else if (isDirectMention({ title, snippet, name, handles: [...allTrusted] })) {
        hit.kind = "mention";
        hit.relation = "mentioned";
      } else {
        profiles.splice(i, 1);
        seen.delete(hit.url);
      }
      continue;
    }

    const netHandles = [...(trustedByNetwork.get(hit.network) || [])];
    const ownHandle = netHandles.find((h) => {
      const u = url.toLowerCase();
      return u.includes(`/${h}/`) || u.includes(`/@${h}`) || String(hit.handle || "").toLowerCase() === h;
    }) || "";

    if (ownHandle && isLikelyOwnPost({ title, snippet, url, name, handle: ownHandle })) {
      hit.kind = "post";
      hit.relation = "own";
      hit.handle = hit.handle || ownHandle;
      continue;
    }
    if (isLikelyOwnPost({ title, snippet, url, name, handle: ownHandle || "" })) {
      hit.kind = "post";
      hit.relation = "own";
      continue;
    }
    if (isDirectTag({ title, snippet, url, handles: [...allTrusted] })) {
      hit.kind = "tag";
      hit.relation = "tagged";
      continue;
    }
    if (isDirectMention({ title, snippet, name, handles: [...allTrusted] })) {
      hit.kind = "mention";
      hit.relation = "mentioned";
      continue;
    }

    profiles.splice(i, 1);
    seen.delete(hit.url);
  }

  return {
    ok: true,
    profiles,
    searches,
    discoveredHandles: [...allTrusted],
  };
}

function pushHit(profiles, seen, row, networkHint, preferredKind) {
  const url = String(row?.link ?? "").trim();
  if (!url || seen.has(url) || isNoiseUrl(url)) return null;
  seen.add(url);
  // Always trust the URL host over the Serper query network.
  // site:instagram.com queries often return hockey sites, news, etc. — never label those as Instagram.
  const fromUrl = guessNetwork(url);
  const hint = networkHint && networkHint !== "handle" ? String(networkHint) : null;
  let network = fromUrl;
  if (fromUrl === "web" && hint && hint !== "web") {
    // Off-platform organic result from a social query → keep as web, never fake the platform
    network = "web";
  } else if (fromUrl !== "web") {
    network = fromUrl;
  } else if (hint) {
    network = hint;
  }
  const title = String(row?.title ?? "");
  const snippet = String(row?.snippet ?? "");
  const imageUrl = String(row?.imageUrl ?? row?.thumbnailUrl ?? "").trim() || null;
  const kind = classifyHitKind(url, title, snippet, preferredKind);
  const hit = {
    network,
    kind,
    title,
    url,
    snippet,
    imageUrl,
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
