import crypto from "node:crypto";

import { DocumentTypeClassifier } from "./Classifiers/DocumentTypeClassifier.js";
import { BusinessAreaClassifier } from "./Classifiers/BusinessAreaClassifier.js";
import { CategoryClassifier } from "./Classifiers/CategoryClassifier.js";
import { EmployeeApplicabilityClassifier } from "./Classifiers/EmployeeApplicabilityClassifier.js";
import { ConfidenceScorer } from "./Classifiers/ConfidenceScorer.js";
import { DuplicateDetector } from "./Classifiers/DuplicateDetector.js";

function sha256(str) {
  return crypto.createHash("sha256").update(String(str)).digest("hex");
}

function deterministicNowISO(nowISO) {
  return typeof nowISO === "string" ? new Date(nowISO).toISOString() : new Date().toISOString();
}

function makeReportId({ processedDocument, fingerprint } = {}) {
  const base = `${processedDocument?.id ?? ""}:${fingerprint}`;
  return `report_${sha256(base).slice(0, 16)}`;
}

function determineReviewRequired({
  confidence,
  duplicateCandidates,
  suggestedCategoryId,
  warnings,
} = {}) {
  const hasDuplicate = Array.isArray(duplicateCandidates) && duplicateCandidates.length > 0;
  const hasLowConfidence = typeof confidence === "number" ? confidence < 0.65 : true;
  const missingCategory = !suggestedCategoryId || String(suggestedCategoryId).trim().length === 0;
  const hasWarnings = Array.isArray(warnings) && warnings.length > 0;

  if (missingCategory) return true;
  if (hasDuplicate) return true;
  if (hasWarnings && confidence < 0.8) return true;
  return hasLowConfidence;
}

export class KnowledgeIntelligenceEngine {
  constructor({ runtime } = {}) {
    this.runtime = runtime;
    this.documentTypeClassifier = new DocumentTypeClassifier();
    this.businessAreaClassifier = new BusinessAreaClassifier();
    this.categoryClassifier = new CategoryClassifier();
    this.employeeApplicabilityClassifier = new EmployeeApplicabilityClassifier();
    this.confidenceScorer = new ConfidenceScorer();
    this.duplicateDetector = new DuplicateDetector({ runtime });
  }

  analyzeProcessedDocument({
    processedDocument,
    nowISO,
  } = {}) {
    if (!processedDocument || typeof processedDocument !== "object") {
      throw new Error("KnowledgeIntelligenceEngine: processedDocument is required.");
    }

    const documentTypeResult = this.documentTypeClassifier.classify({ processedDocument });
    const businessAreaResult = this.businessAreaClassifier.classify({ processedDocument });

    const categoryResult = this.categoryClassifier.classify({ documentTypeResult, businessAreaResult });

    const duplicate = this.duplicateDetector.findDuplicateCandidates({
      processedDocument,
      suggestedTags: categoryResult?.suggestedTags ?? [],
    });

    const { suggestedEmployees } = this.employeeApplicabilityClassifier.classify({
      runtime: this.runtime,
      categoryId: categoryResult?.suggestedCategoryId,
      suggestedTags: categoryResult?.suggestedTags ?? [],
      businessAreas: businessAreaResult?.businessAreas ?? [],
      documentType: documentTypeResult?.detectedDocumentType,
    });

    const confidenceResult = this.confidenceScorer.score({
      processedDocument,
      documentTypeResult,
      businessAreaResult,
      categoryResult,
      duplicateCandidates: duplicate.duplicateCandidates,
      suggestedEmployees,
    });

    const reviewRequired = determineReviewRequired({
      confidence: confidenceResult.confidence,
      duplicateCandidates: duplicate.duplicateCandidates,
      suggestedCategoryId: categoryResult?.suggestedCategoryId,
      warnings: processedDocument?.warnings ?? [],
    });

    const reportFingerprint = duplicate.fingerprint || sha256(processedDocument?.plainText ?? "");
    const reportId = makeReportId({ processedDocument, fingerprint: reportFingerprint });

    const generatedAt = deterministicNowISO(nowISO);

    return Object.freeze({
      reportId,
      processedDocumentId: processedDocument.id,
      detectedDocumentType: documentTypeResult.detectedDocumentType,
      suggestedCategoryId: categoryResult.suggestedCategoryId,
      suggestedTags: categoryResult.suggestedTags,
      businessAreas: businessAreaResult.businessAreas,
      suggestedEmployees,
      confidence: confidenceResult.confidence,
      duplicateCandidates: duplicate.duplicateCandidates,
      reviewRequired,
      warnings: [
        ...(Array.isArray(processedDocument?.warnings) ? processedDocument.warnings : []),
        ...((duplicate.duplicateCandidates?.length ?? 0) > 0
          ? ["Potential duplicate knowledge item detected (exact fingerprint match)."]
          : []),
      ],
      metadata: {
        documentTypeSignals: documentTypeResult.typeSignals,
        businessAreaSignals: businessAreaResult.areaSignals,
        confidenceBreakdown: confidenceResult.confidenceBreakdown,
      },
      generatedAt,
    });
  }
}

