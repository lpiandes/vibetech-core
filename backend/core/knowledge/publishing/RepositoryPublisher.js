import { createCompanyEvent } from "../../company/events/CompanyEvent.js";
import { COMPANY_EVENT_TYPES } from "../../company/events/CompanyEventTypes.js";

function deepFreeze(value) {
  if (!value || typeof value !== "object") return value;
  if (Object.isFrozen(value)) return value;
  for (const key of Object.keys(value)) deepFreeze(value[key]);
  return Object.freeze(value);
}

function requireString(value, name) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`RepositoryPublisher: expected ${name} to be a non-empty string.`);
  }
}

function deterministicAddMsISO(iso, ms) {
  const d = new Date(iso);
  return new Date(d.getTime() + ms).toISOString();
}

function isPlainObject(v) {
  return Boolean(v) && typeof v === "object" && !Array.isArray(v);
}

export class RepositoryPublisher {
  constructor({ runtime } = {}) {
    if (!runtime) throw new Error("RepositoryPublisher requires runtime.");
    this.runtime = runtime;
  }

  /**
   * Repository write happens only through KNOWLEDGE_CREATED (CompanyEventEngine).
   * @param {object} params
   * @param {object} params.proposedKnowledgeItem (proposal-shaped KnowledgeItem)
   * @param {string} params.nowISO deterministic timestamp
   */
  publishProposedKnowledgeItem({ proposedKnowledgeItem, nowISO, createdBy = "knowledge-publishing-engine" } = {}) {
    if (!isPlainObject(proposedKnowledgeItem)) {
      throw new Error("RepositoryPublisher: proposedKnowledgeItem object required.");
    }

    const knowledgeId = String(proposedKnowledgeItem?.id ?? "");
    requireString(knowledgeId, "proposedKnowledgeItem.id");

    const payload = deepFreeze({
      ...proposedKnowledgeItem,
      createdBy: String(createdBy),
      updatedBy: String(createdBy),
    });

    const createdEvent = createCompanyEvent({
      id: `kn_evt_pub_${knowledgeId}_${String(nowISO).replace(/[^a-zA-Z0-9]/g, "")}_created`,
      timestampISO: deterministicAddMsISO(nowISO, 10),
      type: COMPANY_EVENT_TYPES.KNOWLEDGE_CREATED,
      source: "knowledge-publishing-engine",
      payload,
    });

    this.runtime.applyEvent(createdEvent);

    return {
      knowledgeItemId: knowledgeId,
      knowledgeItemVersion: payload?.version ?? 1,
      createdEventId: createdEvent.id,
    };
  }
}

