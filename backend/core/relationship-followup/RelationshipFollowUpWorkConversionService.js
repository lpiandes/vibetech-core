import { createHash } from "node:crypto";

import { WorkCreationService } from "../pipelines/request-to-work/WorkCreationService.js";
import { RUNTIME_SNAPSHOT_KINDS } from "../persistence/RuntimeSnapshotKinds.js";

import { buildRelationshipFollowUpProjection } from "./RelationshipFollowUpProjection.js";
import { workMatchesRelationshipFollowUp } from "./RelationshipFollowUpEvidence.js";

function fail(message) {
  throw new Error(`RelationshipFollowUpWorkConversionService: ${message}`);
}

function safeArray(v) {
  return Array.isArray(v) ? v : [];
}

function deterministicWorkId(candidateId) {
  const hash = createHash("sha256").update(String(candidateId)).digest("hex").slice(0, 24);
  return `work_relationship_followup_${hash}`;
}

function findOpenMatchingWork({ workRuntime, candidate }) {
  const closed = new Set(["completed", "cancelled", "failed", "rejected"]);
  return safeArray(workRuntime?.getWorkItems?.()).find((work) => {
    if (closed.has(String(work.status))) return false;
    return workMatchesRelationshipFollowUp({
      work,
      candidateId: candidate.candidateId,
      partyId: candidate.partyId,
      relationshipType: candidate.relationshipType,
      ruleId: candidate.ruleId,
      targetWorkType: candidate.targetWork?.workType,
    });
  }) ?? null;
}

export class RelationshipFollowUpWorkConversionService {
  constructor({ workCreationService } = {}) {
    this.workCreationService = workCreationService ?? new WorkCreationService();
  }

  execute({
    stack,
    installationResult,
    candidateId,
    nowISO,
  } = {}) {
    if (!stack) fail("stack required.");
    if (!candidateId) fail("candidateId required.");
    if (!stack.workRuntime) fail("stack.workRuntime required.");
    if (!stack.osWorkPublisher) fail("stack.osWorkPublisher required.");

    const timestampISO = String(nowISO ?? stack.nowISO ?? "2026-07-01T00:00:00.000Z");
    const projection = buildRelationshipFollowUpProjection({
      businessGraphRuntime: stack.businessGraphRuntime,
      requestRuntime: stack.requestRuntime,
      workRuntime: stack.workRuntime,
      interactionRuntime: stack.interactionRuntime,
      communicationRuntime: stack.communicationRuntime,
      businessSubjectRuntime: stack.businessSubjectRuntime,
      communicationPreferenceRuntime: stack.communicationPreferenceRuntime,
      relationshipFollowUpRules: installationResult?.relationshipFollowUpRules ?? [],
      relationshipTypes: installationResult?.relationshipTypes ?? [],
      nowISO: timestampISO,
    });

    const candidate = projection.candidates.find((entry) => String(entry.candidateId) === String(candidateId));
    if (!candidate) {
      return {
        ok: false,
        reason: "candidate_not_found",
        message: "Relationship follow-up candidate is no longer available.",
        created: false,
        existing: false,
        workItem: null,
        snapshotKinds: [],
      };
    }

    const existingOpen = findOpenMatchingWork({ workRuntime: stack.workRuntime, candidate });
    if (existingOpen) {
      return {
        ok: true,
        reason: null,
        created: false,
        existing: true,
        workItem: existingOpen,
        candidate,
        snapshotKinds: [],
      };
    }

    const workItemId = deterministicWorkId(candidate.candidateId);
    const existingById = stack.workRuntime.getWorkItem?.(workItemId) ?? null;
    if (existingById && !["completed", "cancelled", "failed", "rejected"].includes(String(existingById.status))) {
      return {
        ok: true,
        reason: null,
        created: false,
        existing: true,
        workItem: existingById,
        candidate,
        snapshotKinds: [],
      };
    }

    const analyticsBefore = stack.analyticsRuntime?.getDataPoints?.()?.length ?? 0;
    const target = candidate.targetWork ?? {};
    const workItemInput = {
      id: workItemId,
      title: String(target.title ?? "Prospect follow-up"),
      description: String(target.description ?? candidate.reasonLabel ?? "Review relationship context and complete follow-up."),
      workType: String(target.workType ?? "prospect_follow_up"),
      status: "new",
      priority: String(candidate.priority ?? "medium"),
      stageId: String(target.stageId ?? "stage_follow_up"),
      queueId: String(target.queueId ?? "queue_follow_up"),
      assignedTo: "unassigned",
      requestedBy: String(candidate.partyId),
      source: "relationship_followup",
      dueAt: null,
      completedAt: null,
      blockedReason: null,
      relatedObjects: safeArray(candidate.relatedObjects),
      requirements: [],
      createdAt: timestampISO,
      updatedAt: timestampISO,
      metadata: {
        relationshipFollowUp: {
          candidateId: String(candidate.candidateId),
          ruleId: String(candidate.ruleId),
          relationshipType: String(candidate.relationshipType),
          reasonCode: String(candidate.reasonCode),
        },
      },
    };

    const created = this.workCreationService.createWorkItem({
      workRuntime: stack.workRuntime,
      workItemInput,
      requestConvertedEventId: `relationship_followup:${candidate.candidateId}`,
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
    const published = stack.osWorkPublisher.publishWorkCreated({
      workRuntime: stack.workRuntime,
      createdWorkItem,
      createdAtISO: timestampISO,
      metadata: { derivedFrom: { source: "relationship_followup", candidateId: String(candidate.candidateId) } },
    });

    if (String(published?.status ?? "PUBLISHED") !== "PUBLISHED") {
      return {
        ok: false,
        reason: "work_created_publication_failed",
        message: safeArray(published?.errors).join("; ") || "WORK_CREATED publication failed.",
        created: true,
        existing: false,
        workItem: stack.workRuntime.getWorkItem(workItemId),
        candidate,
        snapshotKinds: [RUNTIME_SNAPSHOT_KINDS.WORK],
      };
    }

    const snapshotKinds = [RUNTIME_SNAPSHOT_KINDS.WORK];
    const analyticsAfter = stack.analyticsRuntime?.getDataPoints?.()?.length ?? 0;
    if (analyticsAfter > analyticsBefore) snapshotKinds.push(RUNTIME_SNAPSHOT_KINDS.ANALYTICS);

    return {
      ok: true,
      reason: null,
      created: true,
      existing: false,
      workItem: stack.workRuntime.getWorkItem(workItemId),
      candidate,
      snapshotKinds,
    };
  }
}

export function relationshipFollowUpWorkIdForCandidate(candidateId) {
  return deterministicWorkId(candidateId);
}
