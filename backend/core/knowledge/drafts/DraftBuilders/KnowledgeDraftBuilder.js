import crypto from "node:crypto";

import { createKnowledgeDraft } from "../KnowledgeDraft.js";
import { buildReviewDecision } from "./ReviewDecision.js";

function sha256(str) {
  return crypto.createHash("sha256").update(String(str)).digest("hex");
}

function deterministicNowISO(nowISO) {
  return typeof nowISO === "string" ? new Date(nowISO).toISOString() : new Date().toISOString();
}

function pickSectionTitle({ processedDocument, sectionIndex } = {}) {
  const headings = Array.isArray(processedDocument?.headings) ? processedDocument.headings : [];
  const heading = headings[sectionIndex];
  const baseTitle = String(processedDocument?.title ?? "").trim();
  if (heading && String(heading).trim().length) return String(heading).trim();
  if (baseTitle.length) return `${baseTitle} - Section ${sectionIndex + 1}`;
  return `Section ${sectionIndex + 1}`;
}

function chooseStatusFromReview(reviewRequired) {
  return reviewRequired ? "NEEDS_REVIEW" : "READY_FOR_PERSISTENCE";
}

function derivePriority(confidence) {
  if (typeof confidence !== "number" || !Number.isFinite(confidence)) return "Low";
  if (confidence >= 0.8) return "High";
  if (confidence >= 0.6) return "Medium";
  return "Low";
}

function normalizeSearchKeywords({ processedDocument, suggestedTags } = {}) {
  const title = String(processedDocument?.title ?? "").toLowerCase();
  const plainText = String(processedDocument?.plainText ?? "").toLowerCase();
  const haystack = `${title} ${plainText}`.slice(0, 800);

  const tokens = haystack
    .split(/[^a-z0-9]+/g)
    .map((t) => t.trim())
    .filter(Boolean);

  const tagTokens = Array.isArray(suggestedTags) ? suggestedTags.map((t) => String(t).toLowerCase()) : [];
  const all = [...tagTokens, ...tokens];

  const seen = new Set();
  const out = [];
  for (const t of all) {
    if (!t) continue;
    if (seen.has(t)) continue;
    seen.add(t);
    out.push(t);
    if (out.length >= 12) break;
  }
  return out;
}

function splitIntoDraftChunks({ processedDocument } = {}) {
  const sections = Array.isArray(processedDocument?.sections) ? processedDocument.sections : [];
  const maxDrafts = 3;

  // Simple splitting: if we have multiple sections, draft per section.
  // This is intentionally conservative and deterministic (no complex decomposition).
  if (sections.length <= 1) {
    return [
      {
        index: 0,
        title: String(processedDocument?.title ?? "").trim() || "Untitled",
        text: String(processedDocument?.plainText ?? "").trim(),
        warnings: processedDocument?.warnings ?? [],
      },
    ];
  }

  const chunks = [];
  for (let i = 0; i < Math.min(sections.length, maxDrafts); i += 1) {
    const sectionText = String(sections[i] ?? "").trim();
    if (!sectionText) continue;
    chunks.push({
      index: i,
      title: pickSectionTitle({ processedDocument, sectionIndex: i }),
      text: sectionText,
      warnings: [],
    });
  }

  if (!chunks.length) {
    return [
      {
        index: 0,
        title: String(processedDocument?.title ?? "").trim() || "Untitled",
        text: String(processedDocument?.plainText ?? "").trim(),
        warnings: processedDocument?.warnings ?? [],
      },
    ];
  }

  return chunks;
}

export class KnowledgeDraftBuilder {
  buildDrafts({
    processedDocument,
    intelligenceReport,
    nowISO,
    createdBy = "knowledge-draft-engine",
  } = {}) {
    if (!processedDocument || typeof processedDocument !== "object") {
      throw new Error("KnowledgeDraftBuilder: processedDocument is required.");
    }
    if (!intelligenceReport || typeof intelligenceReport !== "object") {
      throw new Error("KnowledgeDraftBuilder: intelligenceReport is required.");
    }

    const generatedAt = deterministicNowISO(nowISO);
    const chunks = splitIntoDraftChunks({ processedDocument });

    const proposedCategoryId = String(intelligenceReport?.suggestedCategoryId ?? "").trim();
    const suggestedTags = Array.isArray(intelligenceReport?.suggestedTags)
      ? intelligenceReport.suggestedTags.map((t) => String(t))
      : [];
    const suggestedEmployees = Array.isArray(intelligenceReport?.suggestedEmployees)
      ? intelligenceReport.suggestedEmployees.map((e) => e.employeeId ?? String(e))
      : [];

    const reviewDecision = buildReviewDecision({ intelligenceReport });
    const confidence = reviewDecision.confidence;
    const reviewRequired = reviewDecision.reviewRequired;
    const warnings = reviewDecision.warnings;

    const draftStatus = chooseStatusFromReview(reviewRequired);
    const priority = derivePriority(confidence);

    const drafts = [];
    for (const chunk of chunks) {
      const draftId = `draft_${sha256(
        `${intelligenceReport?.reportId ?? ""}:${processedDocument?.id ?? ""}:${chunk.index}:${chunk.title}`,
      ).slice(0, 16)}`;

      const proposedKnowledgeItemInput = {
        id: `kn_draft_${sha256(`${draftId}:${chunk.text}`).slice(0, 16)}`,
        title: String(chunk.title ?? "Untitled"),
        description: String(chunk.text ?? ""),
        category: proposedCategoryId || "CUSTOM",
        tags: suggestedTags,
        relationships: [],
        version: 1,
        revisionHistory: [],
        createdAt: generatedAt,
        updatedAt: generatedAt,
        createdBy,
        updatedBy: createdBy,
        visibility: "INTERNAL",
        status: draftStatus,
        source: "knowledge_draft_engine",
        confidence,
        priority,
        industry: String(processedDocument?.metadata?.industry ?? "company"),
        applicableEmployees: suggestedEmployees,
        searchKeywords: normalizeSearchKeywords({ processedDocument, suggestedTags }),
        metadata: {
          ...((intelligenceReport?.metadata && typeof intelligenceReport.metadata === "object") ? intelligenceReport.metadata : {}),
          chunkIndex: chunk.index,
          chunkTitle: chunk.title,
          sourceDocumentId: processedDocument?.id ?? "",
          processedDocumentMetadata: processedDocument?.metadata ?? {},
          proposedBy: createdBy,
        },
      };

      const draft = createKnowledgeDraft({
        draftId,
        sourceDocumentId: String(processedDocument?.id ?? ""),
        intelligenceReportId: String(intelligenceReport?.reportId ?? ""),
        proposedKnowledgeItemInput,
        suggestedCategoryId: proposedCategoryId || "CUSTOM",
        suggestedTags,
        suggestedEmployees,
        confidence,
        reviewRequired,
        warnings,
        draftStatus,
        generatedAt,
        metadata: {
          intelligenceReportId: intelligenceReport?.reportId ?? "",
          detectedDocumentType: intelligenceReport?.detectedDocumentType ?? "",
          businessAreas: intelligenceReport?.businessAreas ?? [],
        },
      });

      drafts.push(draft);
    }

    return Object.freeze(drafts);
  }
}

