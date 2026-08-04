import { deepFreeze } from "../workspace/_utils/deepFreeze.js";

function safeArray(v) {
  return Array.isArray(v) ? v : [];
}

function knowledgeExcerpt(doc) {
  const text = String(doc?.contentText ?? doc?.excerpt ?? "").replace(/\s+/g, " ").trim();
  return text ? text.slice(0, 280) : "";
}

function inferredCategoryMatches(doc, allowedIds = []) {
  const haystack = `${doc?.title ?? ""} ${doc?.originalFilename ?? ""}`.toLowerCase();
  return allowedIds.some((id) => {
    const token = String(id).toLowerCase().replace(/^pm_/, "").replace(/_/g, " ");
    return token && haystack.includes(token.split(" ")[0]);
  });
}

/**
 * Deterministic campaign Knowledge selection — mirrors follow-up safeKnowledgeDocuments.
 * No RAG. Ready docs only. Tenant-scoped.
 */
export function selectCampaignKnowledgeDocuments({
  documents = [],
  businessId,
  allowedCategoryIds = [],
  sectionType = null,
  subjectId = null,
  limit = 3,
} = {}) {
  const allowed = new Set(safeArray(allowedCategoryIds).map(String));
  const selected = safeArray(documents)
    .filter((doc) => String(doc?.businessId ?? businessId) === String(businessId))
    .filter((doc) => String(doc?.status ?? "") === "ready")
    .filter((doc) => !doc?.deletedAt)
    .filter((doc) => {
      const categories = safeArray(doc?.categoryIds).map(String);
      if (!allowed.size) return true;
      if (!categories.length) return inferredCategoryMatches(doc, [...allowed]);
      return categories.some((id) => allowed.has(id));
    })
    .filter((doc) => knowledgeExcerpt(doc))
    .map((doc) => ({
      id: String(doc.id),
      title: String(doc.title ?? doc.originalFilename ?? "Knowledge document"),
      sourceType: String(doc.sourceType ?? ""),
      categoryIds: safeArray(doc.categoryIds).map(String),
      excerpt: knowledgeExcerpt(doc),
      reasonSelected: sectionType
        ? `Eligible ready knowledge for ${String(sectionType)} section`
        : "Eligible ready knowledge for campaign content",
      subjectId: subjectId ? String(subjectId) : null,
    }))
    .sort((a, b) => String(a.title).localeCompare(String(b.title)) || String(a.id).localeCompare(String(b.id)))
    .slice(0, Math.max(1, Number(limit) || 3));

  return deepFreeze(selected);
}

export const KNOWLEDGE_BACKED_SECTION_TYPES = Object.freeze([
  "market_update",
  "educational_content",
  "property_feature",
  "custom_text",
  "intro",
]);

export function campaignKnowledgeCategoryIdsForTemplate(templateId, knowledgeExpectations = null) {
  const required = safeArray(knowledgeExpectations?.requiredCategoryIds).map(String);
  if (required.length) return required;
  const id = String(templateId ?? "");
  if (id.includes("market")) return ["PM_OWNER_COMMUNICATION", "PM_LEASING"];
  if (id.includes("property")) return ["PM_LEASING"];
  if (id.includes("referral") || id.includes("past_client")) return ["PM_OWNER_COMMUNICATION"];
  return ["PM_LEASING", "PM_OWNER_COMMUNICATION", "PM_RESIDENT_COMMUNICATION"];
}

export function attachKnowledgeToCampaignDocument({
  document,
  knowledgeSources = [],
  knowledgeExpectations = null,
  campaignTemplateId = null,
} = {}) {
  const sources = safeArray(knowledgeSources);
  const categories = campaignKnowledgeCategoryIdsForTemplate(campaignTemplateId, knowledgeExpectations);
  const nextSections = safeArray(document?.sections).map((section) => {
    if (!KNOWLEDGE_BACKED_SECTION_TYPES.includes(String(section.type))) {
      return section;
    }
    const applicable = selectCampaignKnowledgeDocuments({
      documents: sources.map((source) => ({
        ...source,
        businessId: source.businessId,
        status: "ready",
        contentText: source.excerpt,
        categoryIds: source.categoryIds,
      })),
      businessId: sources[0]?.businessId,
      allowedCategoryIds: categories,
      sectionType: section.type,
      limit: 2,
    });
    const existingRefs = safeArray(section.fields?.knowledgeRefIds).map(String);
    const mergedRefs = [...new Set([...existingRefs, ...applicable.map((entry) => entry.id)])];
    let body = section.fields?.body ?? null;
    if (applicable.length && (!body || String(body).includes("Add approved") || String(body).includes("Optional educational"))) {
      body = applicable.map((entry) => entry.excerpt).join("\n\n");
    }
    return {
      ...section,
      fields: {
        ...section.fields,
        body,
        knowledgeRefIds: mergedRefs,
      },
    };
  });

  const usedIds = new Set(nextSections.flatMap((section) => safeArray(section.fields?.knowledgeRefIds).map(String)));
  const usedSources = sources.filter((source) => usedIds.has(String(source.id)));
  const knowledgeSummary = usedSources.length
    ? `Using ${usedSources.length} approved knowledge source(s): ${usedSources.map((s) => s.title).join("; ")}.`
    : "No Knowledge docs attached yet — write the message below.";

  return deepFreeze({
    sections: nextSections,
    knowledgeSources: usedSources,
    knowledgeSummary,
  });
}
