/**
 * Detect whether a social profile is private (content gated to followers).
 * Uses ScrapingBee page text when available, else Serper snippet signals.
 */

const PRIVATE_TEXT_RE = /this account is private|account is private|"is_private"\s*:\s*true|profile is private|only approved followers|content is private/i;

const NETWORKS_WITH_PRIVACY = new Set(["instagram", "tiktok", "facebook", "threads"]);

export function looksLikePrivateProfileText(text = "") {
  return PRIVATE_TEXT_RE.test(String(text ?? ""));
}

export function looksLikePublicProfileText(text = "") {
  const t = String(text ?? "");
  if (!t.trim()) return false;
  if (looksLikePrivateProfileText(t)) return false;
  // Public IG/TikTok pages usually expose post grids / follower counts without the private gate
  return /\b(\d[\d,]*)\s+(posts?|followers?|following)\b/i.test(t)
    || /\b(posts?|reels?|videos?)\b/i.test(t) && /\bfollowers?\b/i.test(t);
}

/**
 * @param {{
 *   network?: string,
 *   profileUrl?: string,
 *   handle?: string,
 *   existingHits?: object[],
 *   scrapingBeeApiKey?: string,
 *   serperApiKey?: string,
 *   fetchImpl?: typeof fetch,
 * }} [opts]
 * @returns {Promise<"private"|"public"|"unknown">}
 */
export async function detectProfileVisibility({
  network,
  profileUrl,
  handle,
  existingHits = [],
  scrapingBeeApiKey = "",
  serperApiKey = "",
  fetchImpl = globalThis.fetch?.bind(globalThis),
} = {}) {
  const net = String(network ?? "").toLowerCase();
  if (!NETWORKS_WITH_PRIVACY.has(net)) return "unknown";

  const url = String(profileUrl ?? "").trim();
  const h = String(handle ?? "").replace(/^@/, "").trim();

  // Strong signal: we already found their own posts on this network → public
  const hasOwnPosts = (Array.isArray(existingHits) ? existingHits : []).some(
    (hit) => String(hit.network).toLowerCase() === net
      && String(hit.kind) === "post"
      && hit.relation === "own",
  );
  if (hasOwnPosts) return "public";

  // Check Serper hits already collected for private language
  for (const hit of existingHits) {
    if (String(hit.network).toLowerCase() !== net) continue;
    const blob = `${hit.title ?? ""} ${hit.snippet ?? ""}`;
    if (looksLikePrivateProfileText(blob)) return "private";
  }

  if (scrapingBeeApiKey && url && typeof fetchImpl === "function") {
    try {
      const { fetchPublicPageText } = await import("./scrapingBeeFetch.js");
      const page = await fetchPublicPageText({
        url,
        scrapingBeeApiKey,
        fetchImpl,
        maxChars: 8000,
      });
      if (page.ok && page.text) {
        if (looksLikePrivateProfileText(page.text)) return "private";
        if (looksLikePublicProfileText(page.text)) return "public";
      }
    } catch {
      // fall through to Serper probe
    }
  }

  if (serperApiKey && (url || h) && typeof fetchImpl === "function") {
    const { serperSearch } = await import("./serperSocialDiscovery.js");
    const queries = [];
    if (net === "instagram" && h) {
      queries.push(`site:instagram.com/${h}`, `"${h}" "This account is private" site:instagram.com`);
    } else if (net === "tiktok" && h) {
      queries.push(`site:tiktok.com/@${h}`, `"@${h}" "This account is private" site:tiktok.com`);
    } else if (url) {
      queries.push(url);
    }

    for (const q of queries.slice(0, 2)) {
      const rows = await serperSearch({
        query: q,
        apiKey: serperApiKey,
        fetchImpl,
        num: 5,
      });
      for (const row of rows) {
        const blob = `${row.title ?? ""} ${row.snippet ?? ""}`;
        if (looksLikePrivateProfileText(blob)) return "private";
      }
    }
  }

  return "unknown";
}

export function privatePostsMessage(network) {
  const label = network === "tiktok" ? "TikTok" : network === "instagram" ? "Instagram" : "This";
  return `Private profile — can't extract ${label} posts.`;
}

export function privateTagsMessage() {
  return "Private profile — can't extract their Tagged tab. Only public posts that @mention them (if Google indexed them) can appear here.";
}

export function unknownEmptyPostsMessage() {
  return "No indexed posts from this profile yet. If the account is private, their posts can't be extracted.";
}

export function unknownEmptyTagsMessage() {
  return "No @tags found in indexed public posts. If the account is private, their Tagged tab can't be extracted.";
}
