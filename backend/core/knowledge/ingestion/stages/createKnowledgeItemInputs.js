import crypto from "node:crypto";

function stableIdPart(value) {
  return String(value ?? "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function sha256(str) {
  return crypto.createHash("sha256").update(String(str)).digest("hex");
}

function defaultNowISO(provided) {
  return typeof provided === "string" ? new Date(provided).toISOString() : new Date().toISOString();
}

/**
 * Creates canonical KnowledgeItem inputs (not yet persisted).
 */
export function createKnowledgeItemInputs({
  categoryId,
  sourceId,
  filename,
  nowISO,
  createdBy,
  updatedBy,
  knowledgeItemId,
  extractedMetadata,
  industry,
  applicableEmployees,
} = {}) {
  const baseNow = defaultNowISO(nowISO);
  const inferred = extractedMetadata ?? {};

  const contentHash = sha256(inferred.description ?? inferred.title ?? filename ?? sourceId);
  const itemId = knowledgeItemId ?? `kn_ing_${stableIdPart(sourceId)}_${contentHash.slice(0, 12)}`;

  // Deterministic single-item ingestion for Sprint 3.
  return [
    {
      id: itemId,
      title: String(inferred.title ?? "Untitled knowledge"),
      description: String(inferred.description ?? ""),
      category: String(categoryId ?? ""),
      tags: Array.isArray(inferred.tags) ? inferred.tags : [],
      relationships: [],
      version: 1,
      revisionHistory: [],
      createdAt: baseNow,
      updatedAt: baseNow,
      createdBy: String(createdBy ?? "knowledge-ingestion-engine"),
      updatedBy: String(updatedBy ?? "knowledge-ingestion-engine"),
      visibility: "INTERNAL",
      status: "ACTIVE",
      source: `file_ingestion:${String(inferred.metadata?.sourceType ?? "")}`,
      confidence: typeof inferred.confidence === "number" ? inferred.confidence : 0.6,
      priority: "Medium",
      industry: String(industry ?? ""),
      applicableEmployees: Array.isArray(applicableEmployees) ? applicableEmployees : [],
      searchKeywords: Array.isArray(inferred.searchKeywords) ? inferred.searchKeywords : [],
      metadata: {
        ...inferred.metadata,
        ingestion: { filename, sourceId },
      },
    },
  ];
}

