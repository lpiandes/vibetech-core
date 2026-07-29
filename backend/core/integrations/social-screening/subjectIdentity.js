/**
 * Universal subject-identity rules for Social Checker / screening discovery.
 *
 * These rules are the same for EVERY person and EVERY platform
 * (Instagram, TikTok, LinkedIn, X, Facebook, …). Nothing is name- or brand-specific.
 *
 * HARD RULES
 * 1. A PROFILE belongs to the subject only if:
 *    - the user typed that platform handle, OR
 *    - the result TITLE contains the subject's full name, AND
 *    - the title does not lead with a different person's name
 *    Snippet-only name matches NEVER claim a profile (teammates mention each other).
 *
 * 2. Keep EVERY profile that passes rule 1 on a platform (2 LinkedIns, 2 Instagrams, etc.).
 *
 * 3. OWN POSTS only from trusted subject handles on that platform, and never when the
 *    title leads with someone else's name.
 *
 * 4. TAGS / MENTIONS may come from other people's public posts, but only when the
 *    subject is clearly @tagged or named in the title (or tagged language + name).
 */

import {
  extractHandleFromUrl,
  isDirectMention,
  isDirectTag,
  isLikelyOwnPost,
  looksLikeRosterOcrPollution,
  nameMatchesSubject,
  profileLooksLikeSubject,
  titleLeadsWithDifferentPerson,
} from "./serperSocialDiscovery.js";

/** Max subject profiles we will retain / crawl own-posts for, per platform. */
export const MAX_SUBJECT_PROFILES_PER_NETWORK = 6;

/**
 * Does this hit qualify as the subject's own profile on its platform?
 * Same criteria for all networks.
 */
export function isSubjectProfile(hit = {}, subject = {}) {
  const name = String(subject.name ?? "").trim();
  const handles = Array.isArray(subject.handles) ? subject.handles : [];
  return profileLooksLikeSubject({
    title: hit.title,
    snippet: hit.snippet,
    url: hit.url,
    name,
    handles,
  });
}

/**
 * Does this hit qualify as a post authored by the subject?
 * Requires a subject handle on the URL (or "Name on Platform" title), never another person's byline.
 */
export function isSubjectOwnPost(hit = {}, subject = {}) {
  const name = String(subject.name ?? "").trim();
  const handles = (Array.isArray(subject.handles) ? subject.handles : [])
    .map((h) => String(h).replace(/^@/, "").trim().toLowerCase())
    .filter((h) => h.length >= 2);
  const url = String(hit.url ?? "").toLowerCase();
  const title = String(hit.title ?? "");
  const snippet = String(hit.snippet ?? "");
  const urlHandle = String(hit.handle ?? extractHandleFromUrl(hit.url) ?? "").toLowerCase();

  if (name && titleLeadsWithDifferentPerson(title, name)) return false;

  const matchedHandle = handles.find(
    (h) => url.includes(`/${h}/`)
      || url.includes(`/@${h}`)
      || url.endsWith(`/${h}`)
      || urlHandle === h,
  );
  if (matchedHandle) {
    return isLikelyOwnPost({ title, snippet, url, name, handle: matchedHandle });
  }
  // No known handle on URL — only accept explicit "Full Name on Instagram/…" titles
  return Boolean(
    name
    && new RegExp(
      `${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s+on\\s+(instagram|tiktok|facebook|linkedin|youtube|x|twitter)`,
      "i",
    ).test(title),
  );
}

/**
 * Classify a raw hit into subject-relevant kind, or null to drop.
 * Same gate for every platform.
 *
 * @returns {"profile"|"post"|"tag"|"mention"|null}
 */
export function classifySubjectRelation(hit = {}, subject = {}) {
  const name = String(subject.name ?? "").trim();
  const handles = Array.isArray(subject.handles) ? subject.handles : [];
  const title = String(hit.title ?? "");
  const snippet = String(hit.snippet ?? "");
  const url = String(hit.url ?? "");
  const kindIn = String(hit.kind || "mention");

  if (looksLikeRosterOcrPollution(snippet, name) || looksLikeRosterOcrPollution(title, name)) {
    if (!nameMatchesSubject(title, name) && !isDirectTag({ title, snippet, url, handles })) {
      return null;
    }
    if (looksLikeRosterOcrPollution(snippet, name) && !nameMatchesSubject(title, name)) {
      return null;
    }
  }

  if (kindIn === "profile") {
    return isSubjectProfile(hit, subject) ? "profile" : null;
  }

  // Another person's byline → only keep as tag/mention of the subject
  if (name && titleLeadsWithDifferentPerson(title, name)) {
    if (isDirectTag({ title, snippet, url, handles })) return "tag";
    if (isDirectMention({ title, snippet, name, handles })) return "mention";
    return null;
  }

  if ((kindIn === "post" || hit.relation === "own") && isSubjectOwnPost(hit, { name, handles })) {
    return "post";
  }

  if (isDirectTag({ title, snippet, url, handles }) || kindIn === "tag" || hit.relation === "tagged") {
    return "tag";
  }

  if (isDirectMention({ title, snippet, name, handles })) {
    return "mention";
  }

  return null;
}
