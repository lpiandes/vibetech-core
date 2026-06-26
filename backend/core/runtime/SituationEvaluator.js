/**
 * SituationEvaluator
 *
 * Sprint 1 (Runtime MVP) component:
 * - Identifies the current BUSINESS situation only.
 * - Does NOT make decisions.
 * - Does NOT choose actions.
 * - Does NOT generate text.
 * - Uses deterministic business rules only (no AI/LLM/providers/prompts).
 */

export class SituationEvaluator {
  /**
   * @param {object} [params]
   * @param {number} [params.lowConfidenceThreshold] - Below this, returns LOW_CONFIDENCE.
   * @param {number} [params.longTimeWithoutUpdateDays] - Days threshold for LONG_TIME_WITHOUT_UPDATE.
   */
  constructor({ lowConfidenceThreshold = 0.6, longTimeWithoutUpdateDays = 14 } = {}) {
    this.lowConfidenceThreshold = lowConfidenceThreshold;
    this.longTimeWithoutUpdateDays = longTimeWithoutUpdateDays;
  }

  /**
   * @param {object} input
   * @param {string} [input.attorneyNote]
   * @param {any} [input.caseEvent]
   * @param {number} [input.daysSinceLastClientUpdate]
   * @param {boolean} [input.clientRequestedUpdate]
   * @param {boolean} [input.isUrgent]
   * @param {number} [input.confidence]
   * @returns {{ situation: string, confidence: number, reason: string }}
   */
  evaluate(input) {
    const confidence = this.#normalizeConfidence(input?.confidence);

    // Priority 1: confidence always takes precedence to avoid misclassification.
    if (confidence !== null && confidence < this.lowConfidenceThreshold) {
      return {
        situation: "LOW_CONFIDENCE",
        confidence,
        reason: "Input confidence is below the configured threshold.",
      };
    }

    const days = this.#normalizeDays(input?.daysSinceLastClientUpdate);
    const clientRequestedUpdate = this.#normalizeBoolean(input?.clientRequestedUpdate);
    const isUrgent = this.#normalizeBoolean(input?.isUrgent);
    const attorneyNote = this.#normalizeString(input?.attorneyNote);

    // Priority 2: explicit client request.
    if (clientRequestedUpdate === true) {
      return {
        situation: "CLIENT_REQUESTED_UPDATE",
        confidence: confidence ?? 0.7,
        reason: "Client explicitly requested an update.",
      };
    }

    // Priority 3: attorney note indicating waiting on an external party.
    // Deterministic keyword heuristics (business intent classification only).
    if (attorneyNote && this.#looksLikeWaiting(attorneyNote)) {
      return {
        situation: "WAITING_ON_EXTERNAL_PARTY",
        confidence: confidence ?? 0.7,
        reason: "Attorney note indicates the case is waiting on an external party.",
      };
    }

    // Priority 4: urgent activity.
    if (isUrgent === true) {
      return {
        situation: "URGENT_CASE_ACTIVITY",
        confidence: confidence ?? 0.75,
        reason: "Urgency flag is set for the current activity.",
      };
    }

    // Priority 5: case event presence indicates meaningful activity (if supported).
    if (this.#hasMeaningfulCaseEvent(input?.caseEvent)) {
      return {
        situation: "MEANINGFUL_CASE_EVENT",
        confidence: confidence ?? 0.8,
        reason: "A meaningful case event is present.",
      };
    }

    // Priority 6: time-based long absence.
    if (typeof days === "number" && days >= this.longTimeWithoutUpdateDays) {
      return {
        situation: "LONG_TIME_WITHOUT_UPDATE",
        confidence: confidence ?? 0.7,
        reason: "Days since last client update exceeds the configured threshold.",
      };
    }

    // Priority 7: no meaningful activity.
    // - If there is no client request
    // - and no meaningful event
    // - and we are not in long-time-without-update range
    if (clientRequestedUpdate !== true && !this.#hasMeaningfulCaseEvent(input?.caseEvent)) {
      return {
        situation: "NO_MEANINGFUL_ACTIVITY",
        confidence: confidence ?? 0.65,
        reason: "No meaningful case event and no explicit client request.",
      };
    }

    // Fallback.
    return {
      situation: "UNKNOWN",
      confidence: confidence ?? 0.5,
      reason: "Unable to classify a known situation from the provided inputs.",
    };
  }

  #normalizeConfidence(value) {
    if (typeof value !== "number" || Number.isNaN(value)) return null;
    if (value < 0) return 0;
    if (value > 1) return 1;
    return value;
  }

  #normalizeDays(value) {
    if (typeof value !== "number" || Number.isNaN(value)) return undefined;
    if (value < 0) return 0;
    return value;
  }

  #normalizeBoolean(value) {
    if (value === true) return true;
    if (value === false) return false;
    return null;
  }

  #normalizeString(value) {
    if (typeof value !== "string") return "";
    return value.trim();
  }

  #looksLikeWaiting(attorneyNote) {
    const normalized = attorneyNote.toLowerCase();

    // Deterministic heuristics for common “waiting” intents.
    const waitingKeywords = [
      "waiting",
      "opposing counsel",
      "opponent",
      "external party",
      "awaiting",
      "pending",
      "stay",
      "continuance",
    ];

    // Require at least one waiting word and one party indicator if available.
    const hasWaiting = waitingKeywords.some((k) => normalized.includes(k));

    // If it includes a time-blocking marker, classify as waiting.
    const hasTimeBlocking = ["pending", "awaiting", "waiting on"].some((k) => normalized.includes(k));

    return hasWaiting || hasTimeBlocking;
  }

  #hasMeaningfulCaseEvent(caseEvent) {
    if (!caseEvent) return false;

    // Support structured shapes if provided.
    if (typeof caseEvent === "object") {
      if (caseEvent.isMeaningful === true) return true;
      if (caseEvent.meaningful === true) return true;
      if (caseEvent.type && typeof caseEvent.type === "string") {
        // Conservative: any typed event is considered meaningful.
        return caseEvent.type.trim().length > 0;
      }
    }

    // Support string events as meaningful if non-empty.
    if (typeof caseEvent === "string") {
      return caseEvent.trim().length > 0;
    }

    return false;
  }
}

