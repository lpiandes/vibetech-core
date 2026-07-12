import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";
import { RUNTIME_SNAPSHOT_KINDS } from "../../persistence/RuntimeSnapshotKinds.js";
import { isOpenIntelligenceCandidate } from "../candidates/IntelligenceCandidate.js";

/**
 * Lifecycle transitions for Intelligence Candidates.
 * External communication is never triggered here.
 */
export class IntelligenceCandidateLifecycle {
  dismiss({
    stack,
    candidateId,
    reason,
    actorUserId = null,
    nowISO = new Date().toISOString(),
    platformStore = null,
  } = {}) {
    const runtime = stack?.intelligenceCandidateRuntime;
    if (!runtime) throw new Error("IntelligenceCandidateLifecycle: runtime required.");
    const existing = runtime.getCandidate(candidateId);
    if (!existing) {
      return { ok: false, reason: "candidate_not_found", snapshotKinds: [] };
    }
    if (!reason) {
      return { ok: false, reason: "dismissal_reason_required", snapshotKinds: [] };
    }
    const updated = runtime.transition(candidateId, {
      status: "DISMISSED",
      dismissedAt: nowISO,
      dismissalReason: String(reason),
    }, { nowISO });

    void platformStore?.recordAuditEvent?.({
      actorUserId,
      businessId: existing.businessId,
      action: "intelligence.candidate_dismissed",
      targetType: "intelligence_candidate",
      targetId: candidateId,
      metadata: { dismissalReason: String(reason) },
    })?.catch?.(() => null);

    return deepFreeze({
      ok: true,
      candidate: updated,
      snapshotKinds: [RUNTIME_SNAPSHOT_KINDS.INTELLIGENCE_CANDIDATE],
      silentExternalCommunication: false,
    });
  }

  markInReview({ stack, candidateId, nowISO = new Date().toISOString() } = {}) {
    const runtime = stack?.intelligenceCandidateRuntime;
    const existing = runtime?.getCandidate?.(candidateId);
    if (!existing || !isOpenIntelligenceCandidate(existing)) {
      return { ok: false, reason: "candidate_not_open", snapshotKinds: [] };
    }
    const updated = runtime.transition(candidateId, { status: "IN_REVIEW" }, { nowISO });
    return deepFreeze({
      ok: true,
      candidate: updated,
      snapshotKinds: [RUNTIME_SNAPSHOT_KINDS.INTELLIGENCE_CANDIDATE],
    });
  }

  resolve({
    stack,
    candidateId,
    actorUserId = null,
    nowISO = new Date().toISOString(),
    platformStore = null,
    reason = "condition_cleared",
  } = {}) {
    const runtime = stack?.intelligenceCandidateRuntime;
    const existing = runtime?.getCandidate?.(candidateId);
    if (!existing) return { ok: false, reason: "candidate_not_found", snapshotKinds: [] };
    const updated = runtime.transition(candidateId, {
      status: "RESOLVED",
      resolvedAt: nowISO,
    }, { nowISO });
    void platformStore?.recordAuditEvent?.({
      actorUserId,
      businessId: existing.businessId,
      action: "intelligence.candidate_resolved",
      targetType: "intelligence_candidate",
      targetId: candidateId,
      metadata: { reason },
    })?.catch?.(() => null);
    return deepFreeze({
      ok: true,
      candidate: updated,
      snapshotKinds: [RUNTIME_SNAPSHOT_KINDS.INTELLIGENCE_CANDIDATE],
    });
  }
}
