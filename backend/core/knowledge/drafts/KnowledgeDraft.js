function deepFreeze(value) {
  if (!value || typeof value !== "object") return value;
  if (Object.isFrozen(value)) return value;
  for (const key of Object.keys(value)) deepFreeze(value[key]);
  return Object.freeze(value);
}

function requiredNonEmptyString(value, name) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`KnowledgeDraft: expected ${name} to be a non-empty string.`);
  }
}

function requiredObject(value, name) {
  if (!value || typeof value !== "object") {
    throw new Error(`KnowledgeDraft: expected ${name} to be an object.`);
  }
}

function requiredFiniteNumber(value, name) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`KnowledgeDraft: expected ${name} to be a finite number.`);
  }
}

function requiredBoolean(value, name) {
  if (typeof value !== "boolean") {
    throw new Error(`KnowledgeDraft: expected ${name} to be a boolean.`);
  }
}

function buildProposedKnowledgeItem(input = {}) {
  // Drafts produce a proposal-shaped object that matches the KnowledgeItem schema.
  // The Repository will be the future system responsible for converting proposals into
  // official persisted KnowledgeItems.
  requiredObject(input, "proposedKnowledgeItemInput");

  const id = String(input.id ?? "");
  requiredNonEmptyString(id, "proposedKnowledgeItem.id");

  const title = String(input.title ?? "");
  requiredNonEmptyString(title, "proposedKnowledgeItem.title");

  const description = String(input.description ?? "");
  requiredNonEmptyString(description, "proposedKnowledgeItem.description");

  const category = String(input.category ?? "");
  requiredNonEmptyString(category, "proposedKnowledgeItem.category");

  const tags = Array.isArray(input.tags) ? input.tags.map((t) => String(t)) : [];
  const relationships = Array.isArray(input.relationships) ? input.relationships : [];
  const relationshipsNormalized = relationships.map((r) => ({
    type: String(r?.type ?? ""),
    targetId: String(r?.targetId ?? ""),
  }));

  for (const rel of relationshipsNormalized) {
    requiredNonEmptyString(rel.type, "proposedKnowledgeItem.relationships[].type");
    requiredNonEmptyString(rel.targetId, "proposedKnowledgeItem.relationships[].targetId");
  }

  const version = typeof input.version === "number" && input.version >= 1 ? input.version : 1;
  const revisionHistory = Array.isArray(input.revisionHistory) ? input.revisionHistory : [];

  const createdAt = String(input.createdAt ?? "");
  const updatedAt = String(input.updatedAt ?? "");
  requiredNonEmptyString(createdAt, "proposedKnowledgeItem.createdAt");
  requiredNonEmptyString(updatedAt, "proposedKnowledgeItem.updatedAt");

  const createdBy = String(input.createdBy ?? "");
  const updatedBy = String(input.updatedBy ?? "");
  requiredNonEmptyString(createdBy, "proposedKnowledgeItem.createdBy");
  requiredNonEmptyString(updatedBy, "proposedKnowledgeItem.updatedBy");

  const visibility = String(input.visibility ?? "");
  const status = String(input.status ?? "");
  const source = String(input.source ?? "");
  requiredNonEmptyString(visibility, "proposedKnowledgeItem.visibility");
  requiredNonEmptyString(status, "proposedKnowledgeItem.status");
  requiredNonEmptyString(source, "proposedKnowledgeItem.source");

  const confidence = input.confidence;
  if (typeof confidence !== "number" || !Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
    throw new Error("KnowledgeDraft: proposedKnowledgeItem.confidence must be a number 0..1.");
  }

  const priority = String(input.priority ?? "");
  const industry = String(input.industry ?? "");
  requiredNonEmptyString(priority, "proposedKnowledgeItem.priority");
  requiredNonEmptyString(industry, "proposedKnowledgeItem.industry");

  const applicableEmployees = Array.isArray(input.applicableEmployees)
    ? input.applicableEmployees.map((e) => String(e))
    : [];
  const searchKeywords = Array.isArray(input.searchKeywords)
    ? input.searchKeywords.map((k) => String(k).toLowerCase())
    : [];

  const metadata = input.metadata && typeof input.metadata === "object" ? input.metadata : {};

  return deepFreeze({
    id,
    title,
    description,
    category,
    tags,
    relationships: relationshipsNormalized,
    version,
    revisionHistory,
    createdAt,
    updatedAt,
    createdBy,
    updatedBy,
    visibility,
    status,
    source,
    confidence,
    priority,
    industry,
    applicableEmployees,
    searchKeywords,
    metadata,
  });
}

/**
 * @typedef {object} KnowledgeDraftInput
 * @property {string} draftId
 * @property {string} sourceDocumentId
 * @property {string} intelligenceReportId
 * @property {object} proposedKnowledgeItemInput
 * @property {string} suggestedCategoryId
 * @property {string[]} suggestedTags
 * @property {string[]} suggestedEmployees
 * @property {number} confidence
 * @property {boolean} reviewRequired
 * @property {string[]} warnings
 * @property {string} draftStatus
 * @property {string} generatedAt
 * @property {object} metadata
 */

export function createKnowledgeDraft(input = {}) {
  requiredObject(input, "input");

  requiredNonEmptyString(input.draftId, "draftId");
  requiredNonEmptyString(input.sourceDocumentId, "sourceDocumentId");
  requiredNonEmptyString(input.intelligenceReportId, "intelligenceReportId");
  requiredObject(input.proposedKnowledgeItemInput, "proposedKnowledgeItemInput");

  requiredNonEmptyString(input.suggestedCategoryId, "suggestedCategoryId");
  requiredObject(input.metadata, "metadata");

  const proposedKnowledgeItem = buildProposedKnowledgeItem(input.proposedKnowledgeItemInput);

  const suggestedTags = Array.isArray(input.suggestedTags) ? input.suggestedTags.map(String) : [];
  const suggestedEmployees = Array.isArray(input.suggestedEmployees)
    ? input.suggestedEmployees.map(String)
    : [];

  requiredFiniteNumber(input.confidence, "confidence");
  requiredBoolean(input.reviewRequired, "reviewRequired");

  const warnings = Array.isArray(input.warnings) ? input.warnings.map((w) => String(w)) : [];

  requiredNonEmptyString(input.draftStatus, "draftStatus");
  requiredNonEmptyString(input.generatedAt, "generatedAt");

  const draft = {
    draftId: String(input.draftId),
    sourceDocumentId: String(input.sourceDocumentId),
    intelligenceReportId: String(input.intelligenceReportId),
    proposedKnowledgeItem,
    suggestedCategory: String(input.suggestedCategoryId),
    suggestedTags,
    suggestedEmployees,
    confidence: input.confidence,
    reviewRequired: input.reviewRequired,
    warnings,
    draftStatus: String(input.draftStatus),
    generatedAt: String(input.generatedAt),
    metadata: input.metadata,
  };

  return deepFreeze(draft);
}

