import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";

/**
 * Platform-registered specialty authority packs (domain accelerators).
 *
 * Matching is keyword-driven from the brief — hockey → hockey orgs, baseball → baseball orgs, etc.
 * Non-matching industries (property, clinics, ops, etc.) rely on Business Knowledge.
 * Never invent content; never force a sport pack onto an unrelated brief.
 */
export const SPECIALTY_AUTHORITY_PACKS = Object.freeze([
  Object.freeze({
    id: "usa_hockey_adm",
    org: "USA Hockey",
    domain: "hockey",
    label: "USA Hockey ADM / Practice Plans",
    authorityScore: 95,
    matchKeywords: Object.freeze([
      "hockey", "skating", "ice rink", "puck", "rink", "goaltend",
      "usa hockey", "usahockey", "cross-ice", "small-area",
    ]),
    requireDomainHit: true,
    allowedDomains: Object.freeze(["www.usahockey.com", "usahockey.com", "cdn1.sportngin.com", "cdn4.sportngin.com"]),
    sourceUrls: Object.freeze([
      "https://www.usahockey.com/practiceplans",
      "https://www.usahockey.com/practiceplannerguides",
      "https://www.usahockey.com/trainingmaterials",
    ]),
    excerptPolicy: Object.freeze({ maxPages: 2, maxBytes: 400_000, maxExcerptChars: 2400 }),
  }),
  Object.freeze({
    id: "usa_baseball_coach",
    org: "USA Baseball",
    domain: "baseball",
    label: "USA Baseball Practice Planning",
    authorityScore: 94,
    matchKeywords: Object.freeze([
      "baseball", "softball", "pitching", "hitting", "infield", "outfield",
      "usa baseball", "usab", "diamond", "batting",
    ]),
    requireDomainHit: true,
    allowedDomains: Object.freeze(["usabdevelops.com", "www.usabdevelops.com", "cdn2.sportngin.com", "www.usabaseball.com", "usabaseball.com"]),
    sourceUrls: Object.freeze([
      "https://usabdevelops.com/page/1524/practice-plans",
    ]),
    excerptPolicy: Object.freeze({ maxPages: 2, maxBytes: 400_000, maxExcerptChars: 2400 }),
  }),
  Object.freeze({
    id: "us_soccer_session_plans",
    org: "U.S. Soccer",
    domain: "soccer",
    label: "U.S. Soccer Coaches Session Plans",
    authorityScore: 94,
    matchKeywords: Object.freeze([
      "soccer", "football club", "futbol", "ussf", "u.s. soccer", "us soccer",
      "us youth soccer", "goalkeeper", "pitch",
    ]),
    requireDomainHit: true,
    allowedDomains: Object.freeze([
      "www.ussoccer.com", "ussoccer.com", "learning.ussoccer.com",
      "cdn2.sportngin.com", "www.usyouthsoccer.org", "usyouthsoccer.org",
    ]),
    sourceUrls: Object.freeze([
      "https://www.ussoccer.com/soccer-forward/resource-hub/coaches-session-plans",
    ]),
    excerptPolicy: Object.freeze({ maxPages: 2, maxBytes: 400_000, maxExcerptChars: 2400 }),
  }),
  Object.freeze({
    id: "usa_football_coach",
    org: "USA Football",
    domain: "football",
    label: "USA Football Coaching Resources",
    authorityScore: 93,
    matchKeywords: Object.freeze([
      "football", "flag football", "gridiron", "quarterback", "linebacker",
      "usa football", "tackle football", "seven on seven",
    ]),
    requireDomainHit: true,
    allowedDomains: Object.freeze(["www.usafootball.com", "usafootball.com"]),
    sourceUrls: Object.freeze([
      "https://www.usafootball.com/",
    ]),
    excerptPolicy: Object.freeze({ maxPages: 1, maxBytes: 400_000, maxExcerptChars: 2400 }),
  }),
]);

/**
 * Score how well a pack matches the specialty brief / employee context.
 * @returns {{ pack: object, matchScore: number, rankScore: number, matchedKeywords: string[] }}
 */
export function scoreAuthorityPack(pack, { label = "", purpose = "", instruction = "", industryHints = [] } = {}) {
  const blob = [
    label,
    purpose,
    instruction,
    ...(Array.isArray(industryHints) ? industryHints : []),
  ].join(" ").toLowerCase();

  const matched = (pack.matchKeywords ?? []).filter((kw) => keywordInBlob(blob, kw));
  const matchScore = matched.length;
  if (pack.requireDomainHit && matchScore === 0) {
    return deepFreeze({ pack, matchScore: 0, rankScore: 0, matchedKeywords: [] });
  }
  const authorityScore = Number(pack.authorityScore) || 0;
  const rankScore = matchScore * authorityScore;
  return deepFreeze({ pack, matchScore, rankScore, matchedKeywords: matched });
}

function keywordInBlob(blob, keyword) {
  const kw = String(keyword ?? "").toLowerCase().trim();
  if (!kw) return false;
  if (kw.includes(" ")) return blob.includes(kw);
  const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, "i").test(blob);
}

export function resolveMatchingAuthorityPacks({
  label = "",
  purpose = "",
  instruction = "",
  industryHints = [],
  minMatchScore = 1,
} = {}) {
  return SPECIALTY_AUTHORITY_PACKS
    .map((pack) => scoreAuthorityPack(pack, { label, purpose, instruction, industryHints }))
    .filter((entry) => entry.matchScore >= minMatchScore && entry.rankScore > 0)
    .sort((a, b) => b.rankScore - a.rankScore || b.matchScore - a.matchScore || String(a.pack.id).localeCompare(String(b.pack.id)));
}

export function getAuthorityPackById(packId) {
  return SPECIALTY_AUTHORITY_PACKS.find((pack) => pack.id === String(packId)) ?? null;
}

/** User-facing gap copy — never names a single org; Knowledge is the universal path. */
export const MISSING_CURRICULUM_GAP = Object.freeze({
  code: "missing_curriculum_sources",
  message: "No ready Knowledge guidance and no matching domain authority content. Add trusted materials for this specialty (governing-body curriculum, SOPs, manuals) in Knowledge, then re-run. VIBETech will not invent specialty content.",
});
