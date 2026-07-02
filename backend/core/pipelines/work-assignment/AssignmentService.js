import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";
import { WORK_EVENT_TYPES } from "../../work/WorkEventTypes.js";
import { WORK_ASSIGNMENT_STATUSES } from "../../work/WorkAssignmentTypes.js";
import { createWorkAssignment } from "../../work/WorkAssignment.js";

import {
  ASSIGNMENT_STATUSES,
  ASSIGNMENT_STATUS_REASON,
  UNASSIGNED_ASSIGNEE,
} from "./AssignmentDefaults.js";

import {
  doesMemberMatchWorkType,
  deterministicAssignmentEventId,
  deterministicAssignmentId,
  mapMemberToAssignee,
  mapWorkCreatedEventToAssignmentContext,
} from "./AssignmentMapper.js";

import { validateAssignmentCandidate, validateAssignmentResultShape, validateRuntimes, validateWorkCreatedEvent, validateWorkItemExists } from "./AssignmentValidator.js";

import { CapabilityMatchingEngine } from "../../capabilities/matching/CapabilityMatchingEngine.js";

function fail(message) {
  throw new Error(`AssignmentService: ${message}`);
}

function safeArray(v) {
  return Array.isArray(v) ? v : [];
}

function pickDeterministic(candidates) {
  if (!Array.isArray(candidates) || candidates.length === 0) return null;
  return [...candidates].sort((a, b) => String(a.id).localeCompare(String(b.id)))[0];
}

function memberHasManagerPermission(member) {
  const perms = Array.isArray(member?.permissions) ? member.permissions : [];
  return perms.includes("manager");
}

export class AssignmentService {
  constructor({ workAssignmentEventSource } = {}) {
    this.workAssignmentEventSource = workAssignmentEventSource ?? "work_assignment_pipeline";
  }

  assignOwnership({ workRuntime, teamRuntime, capabilityRuntime, workCreatedEvent, nowISO } = {}) {
    try {
      validateWorkCreatedEvent(workCreatedEvent);
      validateRuntimes({ workRuntime, teamRuntime });

      const { workItemId, assignedTo, workType, createdAtISO } = mapWorkCreatedEventToAssignmentContext(workCreatedEvent);
      const workItem = validateWorkItemExists({ workRuntime, workItemId });

      // Already assigned => deterministic no-op.
      const existing = (workRuntime.getAssignments?.() ?? []).find(
        (a) => String(a.workItemId) === String(workItemId) && String(a.status) === WORK_ASSIGNMENT_STATUSES.ACTIVE,
      );
      if (existing) {
        const res = deepFreeze({
          assignmentId: String(existing.id),
          workItemId: String(workItemId),
          assigneeId: String(existing.assigneeId),
          assignmentReason: ASSIGNMENT_STATUS_REASON.ALREADY_ASSIGNED,
          status: ASSIGNMENT_STATUSES.ASSIGNED,
          runtimeUpdated: false,
          errors: [],
          metadata: {
            derivedFrom: { workCreatedEventId: String(workCreatedEvent?.eventId ?? "") },
            usedCapabilityMatching: false,
            matchResultId: null,
            bestMatchProviderId: null,
            bestMatchScore: null,
            unmatchedRequirements: [],
            fallbackUsed: false,
            fallbackReason: "",
          },
        });
        validateAssignmentResultShape(res);
        return res;
      }

      const members = safeArray(teamRuntime.getMembers?.());
      if (members.length === 0) fail("teamRuntime members must exist.");

      // 1) Explicit assignedTo already exists.
      const explicitCandidate = assignedTo && assignedTo !== UNASSIGNED_ASSIGNEE.id ? members.find((m) => String(m.id) === String(assignedTo)) : null;
      if (explicitCandidate) {
        return this._applyAssignment({
          workRuntime,
          teamRuntime,
          workCreatedEvent,
          workItemId,
          candidate: explicitCandidate,
          assignmentReason: ASSIGNMENT_STATUS_REASON.EXPLICIT_ASSIGNED_TO,
          workType,
          createdAtISO,
          capabilityAssignment: {
            usedCapabilityMatching: false,
            matchResultId: null,
            bestMatchProviderId: null,
            bestMatchScore: null,
            unmatchedRequirements: [],
            fallbackUsed: true,
            fallbackReason: ASSIGNMENT_STATUS_REASON.EXPLICIT_ASSIGNED_TO,
          },
        });
      }

      // Capability-aware preferred path (deterministic evaluation only).
      if (capabilityRuntime) {
        const engine = new CapabilityMatchingEngine({ nowISO: String(nowISO ?? createdAtISO ?? workRuntime.nowISO ?? "2026-07-01T00:00:00.000Z") });
        const matchResult = engine.match({
          workItem,
          capabilityRuntime,
          teamRuntime,
        });

        if (matchResult?.bestMatch?.providerId) {
          const pickedMember = members.find((m) => String(m.id) === String(matchResult.bestMatch.providerId));
          if (pickedMember) {
            return this._applyAssignment({
              workRuntime,
              teamRuntime,
              workCreatedEvent,
              workItemId,
              candidate: pickedMember,
              assignmentReason: ASSIGNMENT_STATUS_REASON.CAPABILITY_BEST_MATCH,
              workType,
              createdAtISO,
              capabilityAssignment: {
                usedCapabilityMatching: true,
                matchResultId: String(matchResult.matchResultId),
                bestMatchProviderId: String(matchResult.bestMatch.providerId),
                bestMatchScore: Number(matchResult.bestMatch.score),
                unmatchedRequirements: Array.isArray(matchResult.unmatchedRequirements) ? matchResult.unmatchedRequirements.map(String) : [],
                fallbackUsed: false,
                fallbackReason: "",
              },
            });
          }
        }
      }

      // Fallback to existing deterministic order.
      // 2) Matching digital employee.
      const digitalMatches = members.filter((m) => String(m.memberType) === "digital_employee" && doesMemberMatchWorkType(m, workType));
      const pickedDigital = pickDeterministic(digitalMatches);
      if (pickedDigital) {
        return this._applyAssignment({
          workRuntime,
          teamRuntime,
          workCreatedEvent,
          workItemId,
          candidate: pickedDigital,
          assignmentReason: ASSIGNMENT_STATUS_REASON.MATCHING_DIGITAL_EMPLOYEE,
          workType,
          createdAtISO,
          capabilityAssignment: {
            usedCapabilityMatching: false,
            matchResultId: null,
            bestMatchProviderId: null,
            bestMatchScore: null,
            unmatchedRequirements: [],
            fallbackUsed: true,
            fallbackReason: ASSIGNMENT_STATUS_REASON.MATCHING_DIGITAL_EMPLOYEE,
          },
        });
      }

      // 3) Matching human employee.
      const humanMatches = members.filter((m) => String(m.memberType) === "human" && doesMemberMatchWorkType(m, workType));
      const pickedHuman = pickDeterministic(humanMatches);
      if (pickedHuman) {
        return this._applyAssignment({
          workRuntime,
          teamRuntime,
          workCreatedEvent,
          workItemId,
          candidate: pickedHuman,
          assignmentReason: ASSIGNMENT_STATUS_REASON.MATCHING_HUMAN_EMPLOYEE,
          workType,
          createdAtISO,
          capabilityAssignment: {
            usedCapabilityMatching: false,
            matchResultId: null,
            bestMatchProviderId: null,
            bestMatchScore: null,
            unmatchedRequirements: [],
            fallbackUsed: true,
            fallbackReason: ASSIGNMENT_STATUS_REASON.MATCHING_HUMAN_EMPLOYEE,
          },
        });
      }

      // 4) Default department owner (deterministic, industry-agnostic).
      const managerHumans = members.filter((m) => String(m.memberType) === "human" && memberHasManagerPermission(m));
      const pickedManagerHuman = pickDeterministic(managerHumans);
      if (pickedManagerHuman) {
        return this._applyAssignment({
          workRuntime,
          teamRuntime,
          workCreatedEvent,
          workItemId,
          candidate: pickedManagerHuman,
          assignmentReason: ASSIGNMENT_STATUS_REASON.DEFAULT_DEPARTMENT_OWNER,
          workType,
          createdAtISO,
          capabilityAssignment: {
            usedCapabilityMatching: false,
            matchResultId: null,
            bestMatchProviderId: null,
            bestMatchScore: null,
            unmatchedRequirements: [],
            fallbackUsed: true,
            fallbackReason: ASSIGNMENT_STATUS_REASON.DEFAULT_DEPARTMENT_OWNER,
          },
        });
      }

      const managers = members.filter((m) => memberHasManagerPermission(m));
      const pickedAnyManager = pickDeterministic(managers);
      if (pickedAnyManager) {
        return this._applyAssignment({
          workRuntime,
          teamRuntime,
          workCreatedEvent,
          workItemId,
          candidate: pickedAnyManager,
          assignmentReason: ASSIGNMENT_STATUS_REASON.DEFAULT_DEPARTMENT_OWNER,
          workType,
          createdAtISO,
          capabilityAssignment: {
            usedCapabilityMatching: false,
            matchResultId: null,
            bestMatchProviderId: null,
            bestMatchScore: null,
            unmatchedRequirements: [],
            fallbackUsed: true,
            fallbackReason: ASSIGNMENT_STATUS_REASON.DEFAULT_DEPARTMENT_OWNER,
          },
        });
      }

      // 5) Unassigned.
      return this._applyUnassigned({
        workRuntime,
        workCreatedEvent,
        workItemId,
        assignmentReason: ASSIGNMENT_STATUS_REASON.UNASSIGNED,
        createdAtISO,
        capabilityAssignment: {
          usedCapabilityMatching: false,
          matchResultId: null,
          bestMatchProviderId: null,
          bestMatchScore: null,
          unmatchedRequirements: [],
          fallbackUsed: true,
          fallbackReason: ASSIGNMENT_STATUS_REASON.UNASSIGNED,
        },
      });
    } catch (err) {
      const message = String(err?.message ?? err);
      const context = workCreatedEvent ? mapWorkCreatedEventToAssignmentContext(workCreatedEvent) : { workItemId: "unknown" };
      return deepFreeze({
        assignmentId: null,
        workItemId: context.workItemId ?? null,
        assigneeId: null,
        assignmentReason: ASSIGNMENT_STATUS_REASON.FAILED,
        status: ASSIGNMENT_STATUSES.FAILED,
        runtimeUpdated: false,
        errors: [message],
        metadata: {
          derivedFrom: { workCreatedEventId: String(workCreatedEvent?.eventId ?? "") },
          usedCapabilityMatching: false,
          matchResultId: null,
          bestMatchProviderId: null,
          bestMatchScore: null,
          unmatchedRequirements: [],
          fallbackUsed: false,
          fallbackReason: "",
        },
      });
    }
  }

  _applyUnassigned({
    workRuntime,
    workCreatedEvent,
    workItemId,
    assignmentReason,
    createdAtISO,
    capabilityAssignment,
  } = {}) {
    const nowISO = String(createdAtISO ?? workCreatedEvent?.occurredAt ?? workRuntime.nowISO ?? "2026-07-01T00:00:00.000Z");
    const assigneeId = UNASSIGNED_ASSIGNEE.id;
    const assigneeType = UNASSIGNED_ASSIGNEE.type;
    const assignmentId = deterministicAssignmentId({ workItemId, assigneeId });
    const eventId = deterministicAssignmentEventId({ workItemId, assigneeId, assignedAtISO: nowISO });

    const assignment = createWorkAssignment({
      id: assignmentId,
      workItemId: String(workItemId),
      assigneeId,
      assigneeType,
      assignedAt: nowISO,
      assignedBy: "team_os",
      status: WORK_ASSIGNMENT_STATUSES.ACTIVE,
      metadata: deepFreeze({ derivedFrom: { workCreatedEventId: String(workCreatedEvent?.eventId ?? "") } }),
    });

    const event = {
      id: eventId,
      timestampISO: nowISO,
      type: WORK_EVENT_TYPES.WORK_ITEM_ASSIGNED,
      source: this.workAssignmentEventSource,
      payload: { assignment },
    };

    workRuntime.applyEvent(event);

    const res = deepFreeze({
      assignmentId,
      workItemId: String(workItemId),
      assigneeId,
      assignmentReason,
      status: ASSIGNMENT_STATUSES.UNASSIGNED,
      runtimeUpdated: true,
      errors: [],
      metadata: {
        derivedFrom: { workCreatedEventId: String(workCreatedEvent?.eventId ?? "") },
        usedCapabilityMatching: Boolean(capabilityAssignment?.usedCapabilityMatching),
        matchResultId: capabilityAssignment?.matchResultId ?? null,
        bestMatchProviderId: capabilityAssignment?.bestMatchProviderId ?? null,
        bestMatchScore: capabilityAssignment?.bestMatchScore ?? null,
        unmatchedRequirements: Array.isArray(capabilityAssignment?.unmatchedRequirements)
          ? capabilityAssignment.unmatchedRequirements.map(String)
          : [],
        fallbackUsed: Boolean(capabilityAssignment?.fallbackUsed),
        fallbackReason: capabilityAssignment?.fallbackReason ?? "",
      },
    });
    validateAssignmentResultShape(res);
    return res;
  }

  _applyAssignment({
    workRuntime,
    teamRuntime,
    workCreatedEvent,
    workItemId,
    candidate,
    assignmentReason,
    createdAtISO,
    capabilityAssignment,
  } = {}) {
    const nowISO = String(createdAtISO ?? workCreatedEvent?.occurredAt ?? workRuntime.nowISO ?? "2026-07-01T00:00:00.000Z");
    const { assigneeId, assigneeType } = mapMemberToAssignee(candidate);

    validateAssignmentCandidate({ teamRuntime, candidate: { assigneeId, assigneeType } });

    const assignmentId = deterministicAssignmentId({ workItemId, assigneeId });
    const eventId = deterministicAssignmentEventId({ workItemId, assigneeId, assignedAtISO: nowISO });

    const assignment = createWorkAssignment({
      id: assignmentId,
      workItemId: String(workItemId),
      assigneeId,
      assigneeType,
      assignedAt: nowISO,
      assignedBy: "team_os",
      status: WORK_ASSIGNMENT_STATUSES.ACTIVE,
      metadata: deepFreeze({ derivedFrom: { workCreatedEventId: String(workCreatedEvent?.eventId ?? "") } }),
    });

    const event = {
      id: eventId,
      timestampISO: nowISO,
      type: WORK_EVENT_TYPES.WORK_ITEM_ASSIGNED,
      source: this.workAssignmentEventSource,
      payload: { assignment },
    };

    workRuntime.applyEvent(event);

    const res = deepFreeze({
      assignmentId,
      workItemId: String(workItemId),
      assigneeId,
      assignmentReason,
      status: ASSIGNMENT_STATUSES.ASSIGNED,
      runtimeUpdated: true,
      errors: [],
      metadata: {
        derivedFrom: { workCreatedEventId: String(workCreatedEvent?.eventId ?? "") },
        usedCapabilityMatching: Boolean(capabilityAssignment?.usedCapabilityMatching),
        matchResultId: capabilityAssignment?.matchResultId ?? null,
        bestMatchProviderId: capabilityAssignment?.bestMatchProviderId ?? null,
        bestMatchScore: capabilityAssignment?.bestMatchScore ?? null,
        unmatchedRequirements: Array.isArray(capabilityAssignment?.unmatchedRequirements)
          ? capabilityAssignment.unmatchedRequirements.map(String)
          : [],
        fallbackUsed: Boolean(capabilityAssignment?.fallbackUsed),
        fallbackReason: capabilityAssignment?.fallbackReason ?? "",
      },
    });

    validateAssignmentResultShape(res);
    return res;
  }
}

