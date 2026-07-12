import { createHash } from "node:crypto";
import { WorkCreationService } from "../../pipelines/request-to-work/WorkCreationService.js";
import { RUNTIME_SNAPSHOT_KINDS } from "../../persistence/RuntimeSnapshotKinds.js";

function fail(message) {
  throw new Error(`IntelligenceToWorkConversionService: ${message}`);
}

function safeArray(v) {
  return Array.isArray(v) ? v : [];
}

function deterministicWorkId(candidateId) {
  const hash = createHash("sha256").update(`intelligence:${candidateId}`).digest("hex").slice(0, 24);
  return `work_intelligence_${hash}`;
}

function closed(status) {
  return ["completed", "cancelled", "failed", "rejected"].includes(String(status));
}

function findOpenMatchingWork({ workRuntime, candidate }) {
  return safeArray(workRuntime?.getWorkItems?.()).find((work) => {
    if (closed(work.status)) return false;
    const meta = work.metadata?.businessIntelligence ?? work.metadata?.intelligence ?? {};
    if (String(meta.candidateId ?? "") === String(candidate.id)) return true;
    if (String(work.id) === deterministicWorkId(candidate.id)) return true;
    return false;
  }) ?? null;
}

/**
 * Convert an Intelligence Candidate into governed Work after human approval.
 * Never auto-creates from candidate existence alone.
 */
export class IntelligenceToWorkConversionService {
  constructor({ workCreationService } = {}) {
    this.workCreationService = workCreationService ?? new WorkCreationService();
  }

  async execute({
    stack,
    candidateId,
    actorUserId = null,
    nowISO,
    platformStore = null,
  } = {}) {
    if (!stack) fail("stack required.");
    if (!candidateId) fail("candidateId required.");
    if (!stack.workRuntime) fail("stack.workRuntime required.");
    if (!stack.intelligenceCandidateRuntime) fail("stack.intelligenceCandidateRuntime required.");

    const timestampISO = String(nowISO ?? stack.nowISO ?? new Date().toISOString());
    const runtime = stack.intelligenceCandidateRuntime;
    const candidate = runtime.getCandidate(candidateId);
    if (!candidate) {
      return {
        ok: false,
        reason: "candidate_not_found",
        message: "Intelligence candidate is no longer available.",
        created: false,
        existing: false,
        workItem: null,
        snapshotKinds: [],
      };
    }

    const existingOpen = findOpenMatchingWork({ workRuntime: stack.workRuntime, candidate });
    if (existingOpen) {
      runtime.transition(candidate.id, {
        status: "CONVERTED_TO_WORK",
        convertedWorkId: existingOpen.id,
      }, { nowISO: timestampISO });
      return {
        ok: true,
        reason: null,
        created: false,
        existing: true,
        workItem: existingOpen,
        candidate: runtime.getCandidate(candidate.id),
        snapshotKinds: [RUNTIME_SNAPSHOT_KINDS.INTELLIGENCE_CANDIDATE],
      };
    }

    const workItemId = deterministicWorkId(candidate.id);
    const existingById = stack.workRuntime.getWorkItem?.(workItemId) ?? null;
    if (existingById && !closed(existingById.status)) {
      runtime.transition(candidate.id, {
        status: "CONVERTED_TO_WORK",
        convertedWorkId: existingById.id,
      }, { nowISO: timestampISO });
      return {
        ok: true,
        reason: null,
        created: false,
        existing: true,
        workItem: existingById,
        candidate: runtime.getCandidate(candidate.id),
        snapshotKinds: [RUNTIME_SNAPSHOT_KINDS.INTELLIGENCE_CANDIDATE],
      };
    }

    const workAction = safeArray(candidate.recommendedActions).find((action) => (
      action.kind === "create_work" || action.actionId === "create_work"
    ));
    const template = workAction?.workTemplate ?? {};

    const analyticsBefore = stack.analyticsRuntime?.getDataPoints?.()?.length ?? 0;
    const workItemInput = {
      id: workItemId,
      title: String(template.title ?? candidate.title),
      description: String(template.description ?? candidate.explanation),
      workType: String(template.workType ?? "intelligence_follow_up"),
      status: "new",
      priority: String(template.priority ?? candidate.severity ?? "medium"),
      stageId: String(template.stageId ?? "stage_follow_up"),
      queueId: String(template.queueId ?? "queue_follow_up"),
      assignedTo: candidate.ownerRef?.id ?? "unassigned",
      requestedBy: actorUserId ?? "system",
      source: "business_intelligence",
      dueAt: null,
      completedAt: null,
      blockedReason: null,
      relatedObjects: safeArray(candidate.relatedObjectRefs).map((ref) => ({
        objectType: ref.objectType,
        objectId: ref.objectId,
      })),
      requirements: [],
      createdAt: timestampISO,
      updatedAt: timestampISO,
      metadata: {
        businessIntelligence: {
          candidateId: String(candidate.id),
          definitionId: String(candidate.definitionId),
          insightId: candidate.insightId,
          recommendationId: candidate.recommendationId,
          evidenceObjectIds: safeArray(candidate.evidence).map((entry) => entry.objectId),
        },
      },
    };

    const created = this.workCreationService.createWorkItem({
      workRuntime: stack.workRuntime,
      workItemInput,
      requestConvertedEventId: `intelligence:${candidate.id}`,
      convertedAtISO: timestampISO,
    });

    if (created.status !== "SUCCESS") {
      return {
        ok: false,
        reason: "work_creation_failed",
        message: safeArray(created.errors).join("; ") || "Work creation failed.",
        created: false,
        existing: false,
        workItem: null,
        candidate,
        snapshotKinds: [],
      };
    }

    const createdWorkItem = stack.workRuntime.getWorkItem(workItemId);
    const snapshotKinds = [RUNTIME_SNAPSHOT_KINDS.WORK, RUNTIME_SNAPSHOT_KINDS.INTELLIGENCE_CANDIDATE];

    if (stack.osWorkPublisher?.publishWorkCreated) {
      const published = stack.osWorkPublisher.publishWorkCreated({
        workRuntime: stack.workRuntime,
        createdWorkItem,
        createdAtISO: timestampISO,
        metadata: {
          derivedFrom: {
            source: "business_intelligence",
            candidateId: String(candidate.id),
          },
        },
      });
      if (String(published?.status ?? "PUBLISHED") !== "PUBLISHED") {
        return {
          ok: false,
          reason: "work_created_publication_failed",
          message: safeArray(published?.errors).join("; ") || "WORK_CREATED publication failed.",
          created: true,
          existing: false,
          workItem: createdWorkItem,
          candidate,
          snapshotKinds: [RUNTIME_SNAPSHOT_KINDS.WORK],
        };
      }
    }

    const analyticsAfter = stack.analyticsRuntime?.getDataPoints?.()?.length ?? 0;
    if (analyticsAfter > analyticsBefore) snapshotKinds.push(RUNTIME_SNAPSHOT_KINDS.ANALYTICS);

    const updated = runtime.transition(candidate.id, {
      status: "CONVERTED_TO_WORK",
      convertedWorkId: workItemId,
    }, { nowISO: timestampISO });

    if (platformStore?.recordAuditEvent) {
      await platformStore.recordAuditEvent({
        actorUserId,
        businessId: candidate.businessId,
        action: "intelligence.candidate_converted_to_work",
        targetType: "intelligence_candidate",
        targetId: candidate.id,
        metadata: { workId: workItemId },
      }).catch(() => null);
    }

    return {
      ok: true,
      reason: null,
      created: true,
      existing: false,
      workItem: createdWorkItem,
      candidate: updated,
      snapshotKinds,
      silentExternalCommunication: false,
    };
  }
}

export function intelligenceWorkIdForCandidate(candidateId) {
  return deterministicWorkId(candidateId);
}
