import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";
import {
  createIntelligenceCandidate,
  isOpenIntelligenceCandidate,
} from "./IntelligenceCandidate.js";

const DEFAULT_STATE = deepFreeze({
  candidates: deepFreeze([]),
  metrics: deepFreeze({ candidateCount: 0, openCount: 0 }),
});

/**
 * Canonical Intelligence Candidate runtime — persisted via workspace snapshots.
 */
export class IntelligenceCandidateRuntime {
  constructor({ seed } = {}) {
    this._state = seed ? seed() : DEFAULT_STATE;
    if (!this._state?.candidates) {
      this._state = DEFAULT_STATE;
    }
    this._state = deepFreeze(this._state);
  }

  getCandidates() {
    return this._state.candidates;
  }

  getOpenCandidates() {
    return this._state.candidates.filter(isOpenIntelligenceCandidate);
  }

  getCandidate(id) {
    return this._state.candidates.find((entry) => String(entry.id) === String(id)) ?? null;
  }

  findByDeduplicationKey(deduplicationKey) {
    return this._state.candidates.find(
      (entry) => String(entry.deduplicationKey) === String(deduplicationKey),
    ) ?? null;
  }

  /**
   * Upsert by deduplicationKey — refresh must not duplicate open candidates.
   */
  upsertCandidate(input, { nowISO = new Date().toISOString() } = {}) {
    const incoming = createIntelligenceCandidate({
      ...input,
      lastEvaluatedAt: nowISO,
    });
    const existing = this.findByDeduplicationKey(incoming.deduplicationKey);
    let nextCandidate = incoming;

    if (existing) {
      const keepStatus = isOpenIntelligenceCandidate(existing)
        || (existing.status === "DISMISSED" && !input.forceReopen)
        || existing.status === "CONVERTED_TO_WORK"
        || existing.status === "CONVERTED_TO_CHANGE_PROPOSAL";

      // Open candidates update in place; dismissed stay dismissed unless forceReopen.
      // Converted stay converted but refresh evidence/summary for memory.
      let status = existing.status;
      if (isOpenIntelligenceCandidate(existing)) {
        status = existing.status === "DETECTED" ? "SURFACED" : existing.status;
      } else if (existing.status === "RESOLVED" && input.reopen) {
        status = "DETECTED";
      } else if (existing.status === "DISMISSED" && input.forceReopen) {
        status = "DETECTED";
      }

      nextCandidate = createIntelligenceCandidate({
        ...existing,
        ...incoming,
        id: existing.id,
        status: keepStatus && !input.reopen && !input.forceReopen
          ? (isOpenIntelligenceCandidate(existing) ? status : existing.status)
          : status,
        detectedAt: existing.detectedAt,
        surfacedAt: existing.surfacedAt
          ?? (status === "SURFACED" || status === "IN_REVIEW" ? nowISO : null),
        dismissedAt: existing.dismissedAt,
        dismissalReason: existing.dismissalReason,
        resolvedAt: status === "RESOLVED" ? (existing.resolvedAt ?? nowISO) : null,
        convertedWorkId: existing.convertedWorkId,
        architectSessionId: existing.architectSessionId,
        version: Number(existing.version ?? 1) + 1,
        lastEvaluatedAt: nowISO,
      });
    }

    const others = this._state.candidates.filter(
      (entry) => String(entry.deduplicationKey) !== String(nextCandidate.deduplicationKey),
    );
    this._state = deepFreeze({
      candidates: deepFreeze([...others, nextCandidate]),
      metrics: deepFreeze({
        candidateCount: others.length + 1,
        openCount: [...others, nextCandidate].filter(isOpenIntelligenceCandidate).length,
      }),
    });
    return nextCandidate;
  }

  transition(id, patch, { nowISO = new Date().toISOString() } = {}) {
    const existing = this.getCandidate(id);
    if (!existing) return null;
    const next = createIntelligenceCandidate({
      ...existing,
      ...patch,
      id: existing.id,
      lastEvaluatedAt: nowISO,
      version: Number(existing.version ?? 1) + 1,
    });
    const others = this._state.candidates.filter((entry) => String(entry.id) !== String(id));
    this._state = deepFreeze({
      candidates: deepFreeze([...others, next]),
      metrics: deepFreeze({
        candidateCount: others.length + 1,
        openCount: [...others, next].filter(isOpenIntelligenceCandidate).length,
      }),
    });
    return next;
  }

  exportState() {
    return this._state;
  }
}
