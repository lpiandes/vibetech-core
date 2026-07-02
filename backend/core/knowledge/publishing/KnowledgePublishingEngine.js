import { KnowledgePublisher } from "./KnowledgePublisher.js";
import { createPublishingResult } from "./PublishingResult.js";

export class KnowledgePublishingEngine {
  constructor({ runtime } = {}) {
    if (!runtime) throw new Error("KnowledgePublishingEngine requires runtime.");
    this.runtime = runtime;
    this.publisher = new KnowledgePublisher({ runtime });
  }

  /**
   * Deterministically publishes an approved draft.
   * @param {object} params
   * @param {object} params.draft approved KnowledgeDraft
   * @param {string} params.nowISO deterministic timestamp
   */
  publishDraft({ draft, nowISO } = {}) {
    const startedAt = nowISO;

    const result = this.publisher.publishDraft({ draft, nowISO });

    if (result.ok === false) {
      return createPublishingResult({
        publishStatus: "FAILED",
        ok: false,
        knowledgeItemId: result.knowledgeItemId,
        publishedKnowledgeItem: null,
        eventsPublished: result.publishedEventIds ?? [],
        generatedAtISO: startedAt,
        warnings: [],
        errors: [result.errorMessage ?? "Knowledge publish failed"],
      });
    }

    const repo = this.runtime.getKnowledgeRepository?.() ?? { items: [] };
    const publishedKnowledgeItem = Array.isArray(repo.items)
      ? repo.items.find((i) => i?.id === result.knowledgeItemId) ?? null
      : null;

    return createPublishingResult({
      publishStatus: "SUCCESS",
      ok: true,
      knowledgeItemId: result.knowledgeItemId,
      publishedKnowledgeItem,
      eventsPublished: result.publishedEventIds ?? [],
      generatedAtISO: startedAt,
      warnings: [],
      errors: [],
    });
  }
}

