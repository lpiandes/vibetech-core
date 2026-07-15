import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";
import { selectCampaignKnowledgeDocuments } from "../../campaigns/CampaignKnowledgeAssembler.js";
import {
  createWebsiteFetchPolicy,
  normalizeWebsiteUrl,
  validateWebsiteUrl,
} from "../WebsiteFetchPolicy.js";
import { resolveMatchingAuthorityPacks, MISSING_CURRICULUM_GAP } from "./SpecialtyAuthorityRegistry.js";

const CURRICULUM_TITLE_HINTS = [
  "practice", "drill", "adm", "curriculum", "workout", "training", "planner",
  "hockey", "skating", "session", "station", "warm-up", "warmup",
];

/**
 * Consult Business Knowledge + registered authority packs for specialty composition.
 * Never invents drill content — returns ranked excerpts and explicit gaps.
 */
export async function consultSpecialtySources({
  label = "",
  purpose = "",
  instruction = "",
  businessId = null,
  knowledgeDocuments = [],
  industryHints = [],
  fetchImpl = null,
  packFixtures = null,
  nowISO = new Date().toISOString(),
} = {}) {
  const brief = String(instruction ?? "").trim();
  const packMatches = resolveMatchingAuthorityPacks({
    label,
    purpose,
    instruction: brief,
    industryHints,
  });

  const knowledgeSources = selectSpecialtyKnowledgeDocuments({
    documents: knowledgeDocuments,
    businessId,
    label,
    purpose,
    instruction: brief,
  });

  const packSources = [];
  for (const match of packMatches.slice(0, 2)) {
    const fetched = await fetchAuthorityPackSources({
      pack: match.pack,
      match,
      fetchImpl,
      packFixtures,
      nowISO,
    });
    packSources.push(...fetched);
  }

  const ranked = rankSpecialtySources({
    knowledgeSources,
    packSources,
    packMatches,
    brief,
  });

  const preferred = ranked[0] ?? null;
  const gaps = [];
  if (!ranked.length) {
    gaps.push({ ...MISSING_CURRICULUM_GAP });
  }

  return deepFreeze({
    sources: ranked,
    preferred,
    packMatches: packMatches.map((entry) => ({
      packId: entry.pack.id,
      org: entry.pack.org,
      matchScore: entry.matchScore,
      rankScore: entry.rankScore,
      matchedKeywords: entry.matchedKeywords,
    })),
    gaps,
    consultedAt: String(nowISO),
  });
}

export function selectSpecialtyKnowledgeDocuments({
  documents = [],
  businessId = null,
  label = "",
  purpose = "",
  instruction = "",
  limit = 6,
} = {}) {
  const blob = `${label} ${purpose} ${instruction}`.toLowerCase();
  const selected = selectCampaignKnowledgeDocuments({
    documents,
    businessId,
    allowedCategoryIds: [],
    limit: Math.max(limit * 2, 8),
  });

  const scored = selected.map((doc) => {
    const hay = `${doc.title} ${doc.excerpt}`.toLowerCase();
    const curriculumHits = CURRICULUM_TITLE_HINTS.filter((hint) => hay.includes(hint)).length;
    const briefHits = blob
      .split(/\W+/)
      .filter((token) => token.length > 3)
      .filter((token) => hay.includes(token)).length;
    const domainFit = curriculumHits * 10 + briefHits;
    return {
      ...doc,
      org: "Business Knowledge",
      url: null,
      knowledgeDocId: doc.id,
      provenance: "knowledge",
      authorityScore: 40 + Math.min(30, curriculumHits * 8),
      domainFit,
      rankScore: domainFit * (40 + Math.min(30, curriculumHits * 8)),
      excerpt: String(doc.excerpt ?? "").slice(0, 2400),
    };
  })
    .filter((doc) => doc.domainFit > 0 || CURRICULUM_TITLE_HINTS.some((hint) => `${doc.title}`.toLowerCase().includes(hint)))
    .sort((a, b) => b.rankScore - a.rankScore || String(a.title).localeCompare(String(b.title)))
    .slice(0, limit);

  // If selector returned ready docs but none matched curriculum filters, still allow
  // documents whose titles/excerpts clearly are curriculum when brief is athletic.
  if (!scored.length && /practice|workout|drill|training|session/i.test(blob)) {
    return deepFreeze(selected.slice(0, limit).map((doc) => ({
      id: `knowledge_${doc.id}`,
      org: "Business Knowledge",
      title: doc.title,
      url: null,
      knowledgeDocId: doc.id,
      provenance: "knowledge",
      authorityScore: 35,
      domainFit: 1,
      rankScore: 35,
      excerpt: String(doc.excerpt ?? "").slice(0, 2400),
      reasonSelected: "Ready Knowledge available for specialty brief",
    })));
  }

  return deepFreeze(scored.map((doc) => ({
    id: `knowledge_${doc.knowledgeDocId}`,
    org: doc.org,
    title: doc.title,
    url: null,
    knowledgeDocId: doc.knowledgeDocId,
    provenance: "knowledge",
    authorityScore: doc.authorityScore,
    domainFit: doc.domainFit,
    rankScore: doc.rankScore,
    excerpt: doc.excerpt,
    reasonSelected: doc.reasonSelected ?? "Eligible ready knowledge for specialty content",
  })));
}

async function fetchAuthorityPackSources({
  pack,
  match,
  fetchImpl,
  packFixtures,
  nowISO,
}) {
  const sources = [];
  const approvedUrls = (pack.sourceUrls ?? []).map((url) => normalizeWebsiteUrl(url)).filter(Boolean);
  const policy = createWebsiteFetchPolicy({
    maxPages: pack.excerptPolicy?.maxPages ?? 2,
    maxBytes: pack.excerptPolicy?.maxBytes ?? 400_000,
  });
  const maxChars = pack.excerptPolicy?.maxExcerptChars ?? 2400;

  for (const sourceUrl of approvedUrls.slice(0, policy.maxPages)) {
    const validation = validateWebsiteUrl(sourceUrl, { approvedUrls });
    if (!validation.ok) continue;

    const fixtureMap = packFixtures instanceof Map ? packFixtures : null;
    const fixtureText = fixtureMap?.get(validation.url)
      ?? fixtureMap?.get(sourceUrl)
      ?? (packFixtures && typeof packFixtures === "object" ? packFixtures[validation.url] ?? packFixtures[sourceUrl] : null);

    let text = "";
    let fetchStatus = "skipped";

    if (typeof fixtureText === "string" && fixtureText.trim()) {
      text = fixtureText;
      fetchStatus = "fixture";
    } else if (typeof fetchImpl === "function") {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), policy.timeoutMs);
        const response = await fetchImpl(validation.url, {
          signal: controller.signal,
          redirect: "follow",
          headers: { accept: "text/html,text/plain" },
        });
        clearTimeout(timer);
        if (response?.ok) {
          const raw = await response.text();
          text = htmlToPlainText(String(raw).slice(0, policy.maxBytes));
          fetchStatus = "fetched";
        } else {
          fetchStatus = "http_error";
        }
      } catch {
        fetchStatus = "fetch_failed";
      }
    } else {
      fetchStatus = "research_unavailable";
    }

    const excerpt = String(text ?? "").replace(/\s+/g, " ").trim().slice(0, maxChars);
    if (!excerpt) continue;

    sources.push({
      id: `pack_${pack.id}_${sources.length + 1}`,
      org: pack.org,
      title: `${pack.label} — ${hostnameOf(validation.url)}`,
      url: validation.url,
      knowledgeDocId: null,
      provenance: "authority_pack",
      packId: pack.id,
      authorityScore: Number(pack.authorityScore) || 0,
      domainFit: match.matchScore,
      rankScore: match.rankScore,
      excerpt,
      fetchStatus,
      consultedAt: String(nowISO),
      reasonSelected: `Matched authority pack (${match.matchedKeywords.join(", ")})`,
    });
  }

  return sources;
}

function rankSpecialtySources({ knowledgeSources, packSources, packMatches, brief }) {
  const bestPackRank = packMatches[0]?.rankScore ?? 0;
  const merged = [
    ...packSources.map((source) => ({
      ...source,
      // Prefer packs when they are the more knowledgeable match for the domain.
      preferBoost: bestPackRank >= 90 ? 50 : bestPackRank >= 50 ? 25 : 0,
    })),
    ...knowledgeSources.map((source) => ({
      ...source,
      preferBoost: 0,
    })),
  ].map((source) => {
    const briefBoost = scoreBriefOverlap(brief, source.excerpt);
    const total = (Number(source.rankScore) || 0) + (Number(source.preferBoost) || 0) + briefBoost;
    return { ...source, rankScore: total };
  });

  return merged
    .sort((a, b) => b.rankScore - a.rankScore
      || (b.authorityScore - a.authorityScore)
      || String(a.id).localeCompare(String(b.id)))
    .map(({ preferBoost, ...rest }) => rest);
}

function scoreBriefOverlap(brief, excerpt) {
  const tokens = String(brief ?? "").toLowerCase().split(/\W+/).filter((t) => t.length > 3);
  if (!tokens.length) return 0;
  const hay = String(excerpt ?? "").toLowerCase();
  return tokens.filter((token) => hay.includes(token)).length * 2;
}

function htmlToPlainText(html) {
  return String(html ?? "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function hostnameOf(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return "source";
  }
}

/**
 * Deterministically split consulted excerpts into activity candidates for phases.
 * Only uses source text — does not invent drill names.
 */
export function extractActivitiesFromSources(sources = [], { maxActivities = 12 } = {}) {
  const activities = [];
  for (const source of sources) {
    const chunks = splitSourceIntoChunks(source.excerpt);
    for (const chunk of chunks) {
      if (activities.length >= maxActivities) break;
      const activity = chunkToActivity(chunk, source, activities.length);
      if (activity) activities.push(activity);
    }
    if (activities.length >= maxActivities) break;
  }
  return deepFreeze(activities);
}

function splitSourceIntoChunks(excerpt) {
  const text = String(excerpt ?? "").replace(/\s+/g, " ").trim();
  if (!text) return [];

  const byHeading = text.split(/(?=\b(?:Warm-?up|Skill|Station|Small-?area|Game|Cool-?down|Debrief|Practice plan|8U|10U|12U|14U)\b)/i)
    .map((part) => part.trim())
    .filter((part) => part.length > 40);

  if (byHeading.length >= 2) return byHeading.slice(0, 8);

  const bySentence = text.match(/[^.!?]+[.!?]+/g)?.map((s) => s.trim()).filter(Boolean) ?? [text];
  const chunks = [];
  let buffer = "";
  for (const sentence of bySentence) {
    buffer = buffer ? `${buffer} ${sentence}` : sentence;
    if (buffer.length >= 120) {
      chunks.push(buffer);
      buffer = "";
    }
  }
  if (buffer) chunks.push(buffer);
  return chunks.slice(0, 8);
}

function chunkToActivity(chunk, source, index) {
  const cleaned = String(chunk ?? "").trim();
  if (cleaned.length < 24) return null;

  const firstSentence = cleaned.split(/(?<=[.!?])\s+/)[0]?.trim() || cleaned.slice(0, 80);
  const name = truncate(stripLeadingListMarker(firstSentence), 90);
  const rest = cleaned.slice(firstSentence.length).trim();
  const stepParts = rest
    ? rest.split(/(?:;|\.\s+|\n|•|\u2022)/).map((s) => s.trim()).filter((s) => s.length > 12).slice(0, 5)
    : [];
  const steps = stepParts.length
    ? stepParts.map((s) => truncate(s.replace(/\.$/, ""), 160))
    : [truncate(cleaned, 200)];

  const lower = cleaned.toLowerCase();
  const visual = inferVisualFromText(lower);

  return {
    id: `src_activity_${index + 1}`,
    name,
    visual,
    setup: source.org ? `From ${source.org}` : "From consulted source",
    steps,
    sourceId: source.id,
    citations: [{
      org: source.org,
      title: source.title,
      url: source.url ?? null,
      knowledgeDocId: source.knowledgeDocId ?? null,
      provenance: source.provenance,
      packId: source.packId ?? null,
    }],
  };
}

function inferVisualFromText(lower) {
  if (/warm|activation|ladder/.test(lower)) return "grid";
  if (/station|skill|technique/.test(lower)) return "station";
  if (/small-?area|3v3|compete|game|scrimmage/.test(lower)) return "compete";
  if (/cool|debrief|recover/.test(lower)) return "recover";
  if (/partner|pair/.test(lower)) return "pair";
  if (/triangle|support/.test(lower)) return "triangle";
  if (/transition|race/.test(lower)) return "arrow";
  if (/board|huddle/.test(lower)) return "board";
  return "station";
}

function stripLeadingListMarker(text) {
  return String(text ?? "").replace(/^[\d]+[.)]\s+/, "").replace(/^[-•]\s+/, "").trim();
}

function truncate(text, max) {
  const value = String(text ?? "");
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1)}…`;
}
