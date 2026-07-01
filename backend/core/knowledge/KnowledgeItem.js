/**
 * KnowledgeItem
 *
 * Immutable model for a single piece of company knowledge.
 * Notes:
 * - KnowledgeItem is intentionally “plain business data” (no orchestration).
 * - Versioning is represented as:
 *   - `version`: current revision number (starting at 1)
 *   - `revisionHistory`: frozen snapshots of prior revisions (old versions)
 */

function deepFreeze(value) {
  if (!value || typeof value !== "object") return value;
  if (Object.isFrozen(value)) return value;
  for (const key of Object.keys(value)) {
    deepFreeze(value[key]);
  }
  return Object.freeze(value);
}

function requiredString(value, name) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`KnowledgeItem: expected ${name} to be a non-empty string.`);
  }
}

function requiredArray(value, name) {
  if (!Array.isArray(value)) {
    throw new Error(`KnowledgeItem: expected ${name} to be an array.`);
  }
}

function optionalArray(value) {
  return Array.isArray(value) ? value : [];
}

/**
 * @typedef {object} KnowledgeItemRelationship
 * @property {string} type
 * @property {string} targetId
 */

/**
 * @typedef {object} KnowledgeItemRevisionSnapshot
 * @property {number} version
 * @property {Array<KnowledgeItemRelationship>} relationships
 * @property {string} title
 * @property {string} description
 * @property {string} category
 * @property {string[]} tags
 * @property {string} visibility
 * @property {string} status
 * @property {string} source
 * @property {number} confidence
 * @property {string} priority
 * @property {string} industry
 * @property {string[]} applicableEmployees
 * @property {string[]} searchKeywords
 * @property {object} metadata
 * @property {string} createdAt
 * @property {string} updatedAt
 * @property {string} createdBy
 * @property {string} updatedBy
 */

/**
 * @typedef {object} KnowledgeItemInput
 * @property {string} id
 * @property {string} title
 * @property {string} description
 * @property {string} category
 * @property {string[]} tags
 * @property {Array<KnowledgeItemRelationship>} relationships
 * @property {number=} version
 * @property {Array<any>=} revisionHistory
 * @property {string} createdAt
 * @property {string} updatedAt
 * @property {string} createdBy
 * @property {string} updatedBy
 * @property {string} visibility
 * @property {string} status
 * @property {string} source
 * @property {number} confidence
 * @property {string} priority
 * @property {string} industry
 * @property {string[]} applicableEmployees
 * @property {string[]} searchKeywords
 * @property {object} metadata
 */

export function createKnowledgeItem(input) {
  if (!input || typeof input !== "object") {
    throw new Error("KnowledgeItem.createKnowledgeItem: input is required.");
  }

  const nowISO = new Date().toISOString();

  const id = String(input.id ?? "");
  requiredString(id, "id");

  requiredString(input.title, "title");
  requiredString(input.description, "description");
  requiredString(input.category, "category");

  const tags = optionalArray(input.tags).map((t) => String(t));
  const relationships = optionalArray(input.relationships).map((r) => ({
    type: String(r?.type ?? ""),
    targetId: String(r?.targetId ?? ""),
  }));

  for (const rel of relationships) {
    requiredString(rel.type, "relationships[].type");
    requiredString(rel.targetId, "relationships[].targetId");
  }

  const version = typeof input.version === "number" && input.version >= 1 ? input.version : 1;

  const revisionHistory = Array.isArray(input.revisionHistory)
    ? input.revisionHistory
    : [];

  const createdAt = String(input.createdAt ?? nowISO);
  const updatedAt = String(input.updatedAt ?? nowISO);

  requiredString(createdAt, "createdAt");
  requiredString(updatedAt, "updatedAt");

  requiredString(input.createdBy ?? "", "createdBy");
  requiredString(input.updatedBy ?? "", "updatedBy");

  requiredString(input.visibility ?? "", "visibility");
  requiredString(input.status ?? "", "status");
  requiredString(input.source ?? "", "source");

  const confidence = typeof input.confidence === "number" ? input.confidence : 0.5;
  if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
    throw new Error("KnowledgeItem: confidence must be a number between 0 and 1.");
  }

  requiredString(input.priority ?? "", "priority");
  requiredString(input.industry ?? "", "industry");

  const applicableEmployees = optionalArray(input.applicableEmployees).map((e) => String(e));
  const searchKeywords = optionalArray(input.searchKeywords).map((k) => String(k).toLowerCase());

  const metadata = input.metadata && typeof input.metadata === "object" ? input.metadata : {};

  const item = {
    id,
    title: String(input.title),
    description: String(input.description),
    category: String(input.category),
    tags,
    relationships,
    version,
    revisionHistory,
    createdAt,
    updatedAt,
    createdBy: String(input.createdBy),
    updatedBy: String(input.updatedBy),
    visibility: String(input.visibility),
    status: String(input.status),
    source: String(input.source),
    confidence,
    priority: String(input.priority),
    industry: String(input.industry),
    applicableEmployees,
    searchKeywords,
    metadata,
  };

  return deepFreeze(item);
}

export { deepFreeze };

