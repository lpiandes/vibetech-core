import { KnowledgeDraftBuilder } from "./DraftBuilders/KnowledgeDraftBuilder.js";

export class KnowledgeDraftEngine {
  constructor({ runtime } = {}) {
    // runtime is intentionally unused for Sprint 6: analysis and deterministic draft building only.
    this.runtime = runtime;
    this.draftBuilder = new KnowledgeDraftBuilder();
  }

  /**
   * @param {object} params
   * @param {object} params.processedDocument
   * @param {object} params.knowledgeIntelligenceReport
   * @param {string=} params.nowISO deterministic timestamp
   */
  generateDrafts({
    processedDocument,
    knowledgeIntelligenceReport,
    nowISO,
  } = {}) {
    if (!knowledgeIntelligenceReport) {
      throw new Error("KnowledgeDraftEngine: knowledgeIntelligenceReport is required.");
    }
    return this.draftBuilder.buildDrafts({
      processedDocument,
      intelligenceReport: knowledgeIntelligenceReport,
      nowISO,
    });
  }
}

