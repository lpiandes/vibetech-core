import { createCompanyEvent } from "../../company/events/CompanyEvent.js";
import { COMPANY_EVENT_TYPES } from "../../company/events/CompanyEventTypes.js";

import { detectSourceType } from "./stages/detectSourceType.js";
import { validateIngestionInput } from "./stages/validateIngestionInput.js";
import { readContentAsString } from "./stages/readContentAsString.js";
import { normalizeContent } from "./stages/normalizeContent.js";
import { extractBasicMetadata } from "./stages/extractBasicMetadata.js";
import { createKnowledgeItemInputs } from "./stages/createKnowledgeItemInputs.js";

function stableIdPart(value) {
  return String(value ?? "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function addMsToISO(iso, ms) {
  const d = new Date(iso);
  return new Date(d.getTime() + ms).toISOString();
}

function safeArray(v) {
  return Array.isArray(v) ? v : [];
}

/**
 * @typedef {object} KnowledgeIngestionResult
 * @property {string} sourceId
 * @property {string} sourceType
 * @property {"SUCCESS"|"FAILED"} status
 * @property {number} knowledgeItemsCreated
 * @property {object} metadata
 * @property {string[]} warnings
 * @property {string[]} errors
 * @property {number} processingTimeMs
 * @property {string[]} eventsPublished
 */

export class KnowledgeIngestionEngine {
  /**
   * @param {object} params
   * @param {CompanyWorkspaceRuntime} params.runtime
   */
  constructor({ runtime } = {}) {
    if (!runtime) throw new Error("KnowledgeIngestionEngine requires `runtime`.");
    this.runtime = runtime;
  }

  /**
   * Ingest external knowledge into runtime via Company Events.
   *
   * @param {object} input
   * @param {string} input.sourceId
   * @param {string} input.filename
   * @param {string} input.content
   * @param {string} input.categoryId
   * @param {string=} input.createdBy
   * @param {string=} input.updatedBy
   * @param {string=} input.nowISO (deterministic timestamp)
   * @param {string=} input.knowledgeItemId (optional deterministic override)
   */
  ingest(input = {}) {
    const warnings = [];
    const errors = [];
    const eventsPublished = [];

    const baseNowISO = input.nowISO ?? new Date().toISOString();
    const createdBy = input.createdBy ?? "knowledge-ingestion-engine";
    const updatedBy = input.updatedBy ?? createdBy;

    const sourceId = String(input.sourceId ?? "");
    const filename = String(input.filename ?? "");
    const content = String(input.content ?? "");
    const categoryId = String(input.categoryId ?? "");

    // Stage 1: Receive Source
    validateIngestionInput({ sourceId, filename, content, categoryId });

    // Stage 3: Detect Source Type
    const detection = detectSourceType({ filename, sourceType: input.sourceType });
    const sourceType = detection.sourceType;

    const clockProcessingTimeMs = 60; // deterministic constant for Sprint 3

    const publish = (event, eventId) => {
      this.runtime.applyEvent(event);
      eventsPublished.push(eventId ?? event.id);
    };

    const sourceReceivedEvent = createCompanyEvent({
      id: `ing_evt_${stableIdPart(sourceId)}_${stableIdPart(sourceType)}_source_received`,
      timestampISO: addMsToISO(baseNowISO, 0),
      type: COMPANY_EVENT_TYPES.KNOWLEDGE_SOURCE_RECEIVED,
      source: "knowledge-ingestion-engine",
      payload: { sourceId, sourceType },
    });
    publish(sourceReceivedEvent);

    try {
      // Stage 2: Validate Source (includes category existence)
      validateIngestionInput({
        sourceId,
        filename,
        content,
        categoryId,
        runtime: this.runtime,
      });

      // Stage 4: Read Content
      const raw = readContentAsString({ sourceType, content });

      // Stage 5: Normalize Content
      const normalized = normalizeContent({ sourceType, raw });

      // Stage 6: Extract Metadata
      const metadata = extractBasicMetadata({
        sourceType,
        filename,
        normalizedText: normalized.text,
      });
      warnings.push(...safeArray(metadata.warnings));

      // Stage 7: Create Knowledge Item(s)
      const knowledgeItemInputs = createKnowledgeItemInputs({
        categoryId,
        sourceId,
        filename,
        nowISO: baseNowISO,
        createdBy,
        updatedBy,
        knowledgeItemId: input.knowledgeItemId,
        extractedMetadata: metadata,
        industry: this.runtime.getCompany().industry,
        applicableEmployees: this.runtime.getEmployees().map((e) => e.employeeId),
      });

      // Stage 8: Publish Company Events (started + KNOWLEDGE_CREATED + completed)
      const startedEvent = createCompanyEvent({
        id: `ing_evt_${stableIdPart(sourceId)}_${stableIdPart(sourceType)}_ingestion_started`,
        timestampISO: addMsToISO(baseNowISO, 1),
        type: COMPANY_EVENT_TYPES.KNOWLEDGE_INGESTION_STARTED,
        source: "knowledge-ingestion-engine",
        payload: { sourceId, sourceType, categoryId },
      });
      publish(startedEvent);

      const knowledgeCreatedEventIds = [];
      let createdCount = 0;
      for (let idx = 0; idx < knowledgeItemInputs.length; idx += 1) {
        const item = knowledgeItemInputs[idx];
        const createdAtISO = addMsToISO(baseNowISO, 10 + idx);
        const createdEvent = createCompanyEvent({
          id: `ing_evt_${stableIdPart(sourceId)}_${stableIdPart(
            sourceType,
          )}_knowledge_created_${idx}`,
          timestampISO: createdAtISO,
          type: COMPANY_EVENT_TYPES.KNOWLEDGE_CREATED,
          source: "knowledge-ingestion-engine",
          payload: { ...item, createdAt: createdAtISO, updatedAt: createdAtISO },
        });
        publish(createdEvent);
        knowledgeCreatedEventIds.push(createdEvent.id);
        createdCount += 1;
      }

      const completedEvent = createCompanyEvent({
        id: `ing_evt_${stableIdPart(sourceId)}_${stableIdPart(sourceType)}_ingestion_completed`,
        timestampISO: addMsToISO(baseNowISO, 100),
        type: COMPANY_EVENT_TYPES.KNOWLEDGE_INGESTION_COMPLETED,
        source: "knowledge-ingestion-engine",
        payload: { sourceId, sourceType, status: "COMPLETED", categoryId, createdCount, metadata },
      });
      publish(completedEvent);

      return /** @type {KnowledgeIngestionResult} */ ({
        sourceId,
        sourceType,
        status: "SUCCESS",
        knowledgeItemsCreated: createdCount,
        metadata,
        warnings,
        errors,
        processingTimeMs: clockProcessingTimeMs,
        eventsPublished,
      });
    } catch (err) {
      const errorMessage = err?.message ?? String(err);
      errors.push(errorMessage);

      // Stage 8 failure event
      const failedEvent = createCompanyEvent({
        id: `ing_evt_${stableIdPart(sourceId)}_${stableIdPart(sourceType)}_ingestion_failed`,
        timestampISO: addMsToISO(baseNowISO, 999),
        type: COMPANY_EVENT_TYPES.KNOWLEDGE_INGESTION_FAILED,
        source: "knowledge-ingestion-engine",
        payload: { sourceId, sourceType, status: "FAILED", errorMessage, categoryId },
      });
      // Best-effort: ingestion failures must never throw.
      try {
        publish(failedEvent);
      } catch {
        // swallow
      }

      return /** @type {KnowledgeIngestionResult} */ ({
        sourceId,
        sourceType,
        status: "FAILED",
        knowledgeItemsCreated: 0,
        metadata: { filename, categoryId },
        warnings,
        errors,
        processingTimeMs: clockProcessingTimeMs,
        eventsPublished,
      });
    }
  }
}

