import { createCompanyEvent } from "../../company/events/CompanyEvent.js";
import { COMPANY_EVENT_TYPES } from "../../company/events/CompanyEventTypes.js";

import { RepositoryPublisher } from "./RepositoryPublisher.js";

function deepFreeze(value) {
  if (!value || typeof value !== "object") return value;
  if (Object.isFrozen(value)) return value;
  for (const key of Object.keys(value)) deepFreeze(value[key]);
  return Object.freeze(value);
}

function requireString(value, name) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`KnowledgePublisher: expected ${name} to be a non-empty string.`);
  }
}

function deterministicAddMsISO(iso, ms) {
  const d = new Date(iso);
  return new Date(d.getTime() + ms).toISOString();
}

function isPlainObject(v) {
  return Boolean(v) && typeof v === "object" && !Array.isArray(v);
}

function validateDraft(draft) {
  if (!draft || typeof draft !== "object") throw new Error("KnowledgePublisher: draft is required.");
  requireString(draft.draftId, "draft.draftId");
  requireString(draft.intelligenceReportId, "draft.intelligenceReportId");

  if (!draft.proposedKnowledgeItem || !isPlainObject(draft.proposedKnowledgeItem)) {
    throw new Error("KnowledgePublisher: draft.proposedKnowledgeItem object required.");
  }

  // Draft engine assumes proposal matches KnowledgeItem schema; we validate key fields deterministically.
  const pk = draft.proposedKnowledgeItem;
  requireString(pk.id, "draft.proposedKnowledgeItem.id");
  requireString(pk.title, "draft.proposedKnowledgeItem.title");
  requireString(pk.description, "draft.proposedKnowledgeItem.description");
  requireString(pk.category, "draft.proposedKnowledgeItem.category");
  requireString(pk.createdAt, "draft.proposedKnowledgeItem.createdAt");
  requireString(pk.updatedAt, "draft.proposedKnowledgeItem.updatedAt");
  requireString(pk.createdBy ?? "", "draft.proposedKnowledgeItem.createdBy");
  requireString(pk.updatedBy ?? "", "draft.proposedKnowledgeItem.updatedBy");
  requireString(pk.visibility, "draft.proposedKnowledgeItem.visibility");
  requireString(pk.status, "draft.proposedKnowledgeItem.status");
  requireString(pk.source, "draft.proposedKnowledgeItem.source");

  if (typeof pk.confidence !== "number") {
    throw new Error("KnowledgePublisher: draft.proposedKnowledgeItem.confidence must be a number.");
  }
  if (pk.confidence < 0 || pk.confidence > 1) {
    throw new Error("KnowledgePublisher: proposedKnowledgeItem.confidence must be 0..1.");
  }

  if (draft.reviewRequired !== false) {
    // Publishing is assumed approved; if reviewRequired is still true, treat as invalid.
    throw new Error("KnowledgePublisher: cannot publish draft with reviewRequired=true.");
  }
}

export class KnowledgePublisher {
  constructor({ runtime } = {}) {
    if (!runtime) throw new Error("KnowledgePublisher requires runtime.");
    this.runtime = runtime;
    this.repositoryPublisher = new RepositoryPublisher({ runtime });
  }

  /**
   * @param {object} params
   * @param {object} params.draft KnowledgeDraft (approved)
   * @param {string} params.nowISO deterministic timestamp
   * @param {string=} params.createdBy
   */
  publishDraft({ draft, nowISO, createdBy = "knowledge-publishing-engine" } = {}) {
    validateDraft(draft);

    requireString(nowISO, "nowISO");

    const knowledgeId = String(draft.proposedKnowledgeItem.id);
    const draftId = String(draft.draftId);

    const startedEvent = createCompanyEvent({
      id: `kn_evt_pub_${knowledgeId}_${draftId}_started`,
      timestampISO: deterministicAddMsISO(nowISO, 0),
      type: COMPANY_EVENT_TYPES.KNOWLEDGE_PUBLISH_STARTED,
      source: "knowledge-publishing-engine",
      payload: {
        draftId,
        knowledgeId,
      },
    });

    const publishedEventIds = [];
    this.runtime.applyEvent(startedEvent);
    publishedEventIds.push(startedEvent.id);

    try {
      const { createdEventId } = this.repositoryPublisher.publishProposedKnowledgeItem({
        proposedKnowledgeItem: draft.proposedKnowledgeItem,
        nowISO,
        createdBy,
      });
      publishedEventIds.push(createdEventId);

      const publishedEvent = createCompanyEvent({
        id: `kn_evt_pub_${knowledgeId}_${draftId}_published`,
        timestampISO: deterministicAddMsISO(nowISO, 20),
        type: COMPANY_EVENT_TYPES.KNOWLEDGE_PUBLISHED,
        source: "knowledge-publishing-engine",
        payload: {
          draftId,
          knowledgeId,
          knowledgeItemVersion: draft.proposedKnowledgeItem.version ?? 1,
        },
      });

      this.runtime.applyEvent(publishedEvent);
      publishedEventIds.push(publishedEvent.id);

      return {
        knowledgeItemId: knowledgeId,
        knowledgeItemVersion: draft.proposedKnowledgeItem.version ?? 1,
        publishedEventIds,
      };
    } catch (err) {
      const errorMessage = err?.message ?? String(err);
      const failedEvent = createCompanyEvent({
        id: `kn_evt_pub_${knowledgeId}_${draftId}_failed`,
        timestampISO: deterministicAddMsISO(nowISO, 999),
        type: COMPANY_EVENT_TYPES.KNOWLEDGE_PUBLISH_FAILED,
        source: "knowledge-publishing-engine",
        payload: {
          draftId,
          knowledgeId,
          errorMessage: deepFreeze(String(errorMessage).slice(0, 180)),
        },
      });

      // Best-effort: publishing failed must not throw.
      try {
        this.runtime.applyEvent(failedEvent);
        publishedEventIds.push(failedEvent.id);
      } catch {
        // swallow
      }

      return {
        ok: false,
        errorMessage,
        knowledgeItemId: knowledgeId,
        knowledgeItemVersion: draft.proposedKnowledgeItem.version ?? 1,
        publishedEventIds,
      };
    }
  }
}

