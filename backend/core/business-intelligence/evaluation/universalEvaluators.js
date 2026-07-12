import { createEvidenceReference } from "../evidence/EvidenceReference.js";

function safeArray(v) {
  return Array.isArray(v) ? v : [];
}

function daysBetween(isoA, isoB) {
  const a = Date.parse(isoA);
  const b = Date.parse(isoB);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.floor((b - a) / (24 * 60 * 60 * 1000));
}

function closedWork(status) {
  return ["completed", "cancelled", "failed", "rejected"].includes(String(status));
}

/**
 * Universal observation evaluators — registered by id, not one file per industry rule.
 */
export const UNIVERSAL_OBSERVATION_EVALUATORS = {
  obs_unassigned_request({ stack, businessId, nowISO, thresholds }) {
    const results = [];
    for (const request of stack.requestRuntime?.getRequests?.() ?? []) {
      if (["completed", "cancelled", "closed"].includes(String(request.status))) continue;
      const hasOwner = Boolean(
        request.ownerId
        || request.assigneeId
        || request.assignedTo
        || request.assignedTeamMemberId
      );
      if (hasOwner) continue;
      results.push({
        subjectKey: `request:${request.id}`,
        title: "Unassigned request",
        summary: `Request ${request.title ?? request.id} has no owner.`,
        explanation: `Open request ${request.id} has no assignee/owner.`,
        severity: "high",
        confidence: 0.9,
        confidenceReason: "Request runtime shows no owner or assignee fields.",
        evidence: [createEvidenceReference({
          objectType: "request",
          objectId: request.id,
          businessId,
          field: "ownerId",
          observedValue: null,
          comparison: "is_null",
          observedAt: nowISO,
          explanation: `Request "${request.title ?? request.id}" is open without an owner.`,
        })],
        relatedObjectRefs: [{ objectType: "request", objectId: request.id }],
      });
    }
    return results;
  },

  obs_overdue_work({ stack, businessId, nowISO }) {
    const results = [];
    for (const work of stack.workRuntime?.getWorkItems?.() ?? []) {
      if (closedWork(work.status)) continue;
      const dueAt = work.dueAt ?? work.dueDate ?? null;
      if (!dueAt) continue;
      if (Date.parse(dueAt) >= Date.parse(nowISO)) continue;
      results.push({
        subjectKey: `work:${work.id}`,
        title: "Overdue work",
        summary: `Work "${work.title ?? work.id}" is past due.`,
        explanation: `Due ${dueAt}, still ${work.status}.`,
        severity: "high",
        confidence: 0.95,
        confidenceReason: "Work dueAt is earlier than evaluation time and status is open.",
        evidence: [createEvidenceReference({
          objectType: "work",
          objectId: work.id,
          businessId,
          field: "dueAt",
          observedValue: dueAt,
          comparison: "older_than_now",
          observedAt: nowISO,
          explanation: `Work item is overdue (due ${dueAt}).`,
        })],
        relatedObjectRefs: [{ objectType: "work", objectId: work.id }],
        ownerRef: work.assigneeId ? { kind: "assignee", id: work.assigneeId } : null,
      });
    }
    return results;
  },

  obs_unassigned_high_priority_work({ stack, businessId, nowISO }) {
    const results = [];
    for (const work of stack.workRuntime?.getWorkItems?.() ?? []) {
      if (closedWork(work.status)) continue;
      const priority = String(work.priority ?? "").toLowerCase();
      if (!["high", "critical", "urgent"].includes(priority)) continue;
      if (work.assigneeId || work.assignedTo) continue;
      results.push({
        subjectKey: `work_unassigned_priority:${work.id}`,
        title: "Unassigned high-priority work",
        summary: `High-priority work "${work.title ?? work.id}" has no assignee.`,
        explanation: "Priority work is open without an owner.",
        severity: "critical",
        confidence: 0.92,
        confidenceReason: "Priority is high/critical and assignee fields are empty.",
        evidence: [createEvidenceReference({
          objectType: "work",
          objectId: work.id,
          businessId,
          field: "priority",
          observedValue: priority,
          comparison: "in",
          threshold: "high|critical|urgent",
          observedAt: nowISO,
          explanation: `High-priority work has no assignee.`,
        })],
        relatedObjectRefs: [{ objectType: "work", objectId: work.id }],
      });
    }
    return results;
  },

  obs_workload_concentration({ stack, businessId, nowISO, thresholds }) {
    const limit = Number(thresholds?.openWorkPerAssignee ?? 8);
    const counts = new Map();
    for (const work of stack.workRuntime?.getWorkItems?.() ?? []) {
      if (closedWork(work.status)) continue;
      const assignee = work.assigneeId ?? work.assignedTo;
      if (!assignee) continue;
      counts.set(String(assignee), (counts.get(String(assignee)) ?? 0) + 1);
    }
    const results = [];
    for (const [assigneeId, count] of counts.entries()) {
      if (count < limit) continue;
      results.push({
        subjectKey: `workload:${assigneeId}`,
        title: "Workload concentration",
        summary: `Assignee ${assigneeId} has ${count} open work items.`,
        explanation: `Open work count ${count} exceeds threshold ${limit}.`,
        severity: "medium",
        confidence: 0.85,
        confidenceReason: `Counted open work assigned to ${assigneeId} against threshold ${limit}.`,
        evidence: [createEvidenceReference({
          objectType: "work",
          objectId: assigneeId,
          businessId,
          field: "openCount",
          observedValue: count,
          comparison: ">=",
          threshold: limit,
          observedAt: nowISO,
          explanation: `${count} open work items are assigned to the same person.`,
        })],
        ownerRef: { kind: "assignee", id: assigneeId },
        relatedObjectRefs: [],
      });
    }
    return results;
  },

  obs_stale_active_relationship({ stack, businessId, nowISO, thresholds }) {
    const staleDays = Number(thresholds?.staleAfterDays ?? 14);
    const results = [];
    const parties = stack.businessGraphRuntime?.getParties?.() ?? [];
    const interactions = stack.interactionRuntime?.getInteractions?.() ?? [];

    for (const party of parties) {
      const relationships = stack.businessGraphRuntime?.getRelationshipsForParty?.(party.id)
        ?? stack.businessGraphRuntime?.listRelationships?.()?.filter((rel) => (
          rel.fromPartyId === party.id || rel.toPartyId === party.id || rel.partyId === party.id
        ))
        ?? [];
      const active = relationships.filter((rel) => {
        const type = String(rel.type ?? rel.relationshipType ?? "").toLowerCase();
        const status = String(rel.status ?? "active").toLowerCase();
        return status === "active" && type && !["ended", "inactive"].includes(status);
      });
      if (!active.length) continue;

      const partyInteractions = interactions.filter((entry) => (
        String(entry.partyId ?? entry.relatedPartyId ?? "") === String(party.id)
      ));
      const latest = partyInteractions
        .map((entry) => entry.occurredAt ?? entry.createdAt)
        .filter(Boolean)
        .sort()
        .at(-1) ?? null;
      const age = latest ? daysBetween(latest, nowISO) : staleDays + 1;
      if (age == null || age < staleDays) continue;

      const rel = active[0];
      results.push({
        subjectKey: `party_stale:${party.id}:${rel.type ?? rel.relationshipType ?? "rel"}`,
        title: "Stale active relationship",
        summary: `${party.displayName ?? party.id} has an active relationship with no meaningful interaction in ${staleDays}+ days.`,
        explanation: latest
          ? `Last meaningful activity ${latest} (${age} days ago).`
          : `No recorded interactions for active relationship.`,
        severity: "medium",
        confidence: latest ? 0.8 : 0.7,
        confidenceReason: latest
          ? `Measured ${age} days since last interaction against ${staleDays}-day threshold.`
          : "No interactions found for an active relationship.",
        evidence: [
          createEvidenceReference({
            objectType: "party",
            objectId: party.id,
            businessId,
            field: "displayName",
            observedValue: party.displayName ?? null,
            observedAt: nowISO,
            explanation: `Party ${party.displayName ?? party.id} remains in an active relationship.`,
          }),
          createEvidenceReference({
            objectType: "relationship",
            objectId: rel.id ?? `${party.id}:${rel.type ?? "rel"}`,
            businessId,
            field: "status",
            observedValue: rel.status ?? "active",
            comparison: "equals",
            threshold: "active",
            observedAt: nowISO,
            explanation: `Relationship type ${rel.type ?? rel.relationshipType ?? "unknown"} is active.`,
          }),
        ],
        missingEvidence: latest ? [] : ["interaction.latestMeaningfulActivityAt"],
        relatedObjectRefs: [
          { objectType: "party", objectId: party.id },
          { objectType: "relationship", objectId: rel.id ?? `${party.id}` },
        ],
      });
    }
    return results;
  },

  obs_approval_bottleneck({ stack, businessId, nowISO, thresholds }) {
    const waitingHours = Number(thresholds?.pendingApprovalHours ?? 24);
    const results = [];
    for (const approval of stack.approvalRuntime?.getRequests?.() ?? []) {
      if (String(approval.status) !== "PENDING") continue;
      const created = approval.createdAt ?? approval.requestedAt;
      const ageHours = created
        ? Math.floor((Date.parse(nowISO) - Date.parse(created)) / (60 * 60 * 1000))
        : waitingHours + 1;
      if (ageHours < waitingHours) continue;
      results.push({
        subjectKey: `approval:${approval.id}`,
        title: "Approval bottleneck",
        summary: `Approval "${approval.title ?? approval.id}" has been pending ${ageHours}+ hours.`,
        explanation: "Pending approval is blocking progress.",
        severity: "high",
        confidence: 0.9,
        confidenceReason: `Pending status for ${ageHours} hours exceeds ${waitingHours}-hour threshold.`,
        evidence: [createEvidenceReference({
          objectType: "approval",
          objectId: approval.id,
          businessId,
          field: "status",
          observedValue: "PENDING",
          comparison: "older_than_hours",
          threshold: waitingHours,
          observedAt: nowISO,
          explanation: `Approval remains PENDING for ${ageHours} hours.`,
        })],
        relatedObjectRefs: [{ objectType: "approval", objectId: approval.id }],
      });
    }
    return results;
  },

  obs_follow_up_commitment_due({ stack, businessId, nowISO, thresholds }) {
    const withinHours = Number(thresholds?.dueSoonHours ?? 48);
    const results = [];
    for (const interaction of stack.interactionRuntime?.getInteractions?.() ?? []) {
      const followUpAt = interaction.followUpAt ?? interaction.nextFollowUpAt;
      if (!followUpAt) continue;
      const hours = Math.floor((Date.parse(followUpAt) - Date.parse(nowISO)) / (60 * 60 * 1000));
      if (hours < 0 || hours > withinHours) continue;
      results.push({
        subjectKey: `followup_due:${interaction.id}`,
        title: "Follow-up commitment due soon",
        summary: `A follow-up is due at ${followUpAt}.`,
        explanation: `Scheduled follow-up falls within ${withinHours} hours.`,
        severity: "medium",
        confidence: 0.88,
        confidenceReason: "Interaction.followUpAt is within the due-soon window.",
        evidence: [createEvidenceReference({
          objectType: "interaction",
          objectId: interaction.id,
          businessId,
          field: "followUpAt",
          observedValue: followUpAt,
          comparison: "within_hours",
          threshold: withinHours,
          observedAt: nowISO,
          explanation: `Follow-up commitment is due soon (${followUpAt}).`,
        })],
        relatedObjectRefs: [{ objectType: "interaction", objectId: interaction.id }],
      });
    }
    return results;
  },

  obs_missed_follow_up_commitment({ stack, businessId, nowISO }) {
    const results = [];
    for (const interaction of stack.interactionRuntime?.getInteractions?.() ?? []) {
      const followUpAt = interaction.followUpAt ?? interaction.nextFollowUpAt;
      if (!followUpAt) continue;
      if (Date.parse(followUpAt) >= Date.parse(nowISO)) continue;
      if (interaction.followUpCompletedAt || interaction.outcome === "follow_up_completed") continue;
      results.push({
        subjectKey: `followup_missed:${interaction.id}`,
        title: "Missed follow-up commitment",
        summary: `Follow-up scheduled for ${followUpAt} is past due.`,
        explanation: "No completion outcome recorded after followUpAt.",
        severity: "high",
        confidence: 0.86,
        confidenceReason: "followUpAt is in the past and no completion outcome is recorded.",
        evidence: [createEvidenceReference({
          objectType: "interaction",
          objectId: interaction.id,
          businessId,
          field: "followUpAt",
          observedValue: followUpAt,
          comparison: "older_than_now",
          observedAt: nowISO,
          explanation: `Missed follow-up commitment (${followUpAt}).`,
        })],
        relatedObjectRefs: [{ objectType: "interaction", objectId: interaction.id }],
      });
    }
    return results;
  },

  obs_request_no_recent_interaction({ stack, businessId, nowISO, thresholds }) {
    const staleDays = Number(thresholds?.staleAfterDays ?? 7);
    const results = [];
    const interactions = stack.interactionRuntime?.getInteractions?.() ?? [];
    for (const request of stack.requestRuntime?.getRequests?.() ?? []) {
      if (["completed", "cancelled", "closed"].includes(String(request.status))) continue;
      const related = interactions.filter((entry) => (
        String(entry.requestId ?? "") === String(request.id)
        || safeArray(entry.relatedObjects).some((ref) => (
          ref.objectType === "request" && String(ref.objectId) === String(request.id)
        ))
      ));
      const latest = related.map((e) => e.occurredAt ?? e.createdAt).filter(Boolean).sort().at(-1);
      const age = latest ? daysBetween(latest, nowISO) : staleDays + 1;
      if (age == null || age < staleDays) continue;
      results.push({
        subjectKey: `request_quiet:${request.id}`,
        title: "Request with no recent meaningful interaction",
        summary: `Request ${request.title ?? request.id} has no meaningful interaction in ${staleDays}+ days.`,
        explanation: latest ? `Last interaction ${latest}.` : "No interactions linked to this request.",
        severity: "medium",
        confidence: 0.8,
        confidenceReason: `Open request without interaction for ${staleDays}+ days.`,
        evidence: [createEvidenceReference({
          objectType: "request",
          objectId: request.id,
          businessId,
          field: "status",
          observedValue: request.status,
          observedAt: nowISO,
          explanation: `Open request lacks recent meaningful interaction.`,
        })],
        missingEvidence: latest ? [] : ["interaction.linkedToRequest"],
        relatedObjectRefs: [{ objectType: "request", objectId: request.id }],
      });
    }
    return results;
  },

  obs_repeated_no_response({ stack, businessId, nowISO, thresholds }) {
    const minCount = Number(thresholds?.minNoResponseCount ?? 2);
    const byParty = new Map();
    for (const interaction of stack.interactionRuntime?.getInteractions?.() ?? []) {
      const outcome = String(interaction.outcome ?? "").toLowerCase();
      if (!outcome.includes("no_response") && !outcome.includes("no-response") && outcome !== "noresponse") continue;
      const partyId = interaction.partyId ?? interaction.relatedPartyId;
      if (!partyId) continue;
      byParty.set(String(partyId), (byParty.get(String(partyId)) ?? 0) + 1);
    }
    const results = [];
    for (const [partyId, count] of byParty.entries()) {
      if (count < minCount) continue;
      results.push({
        subjectKey: `no_response:${partyId}`,
        title: "Repeated no-response outcomes",
        summary: `Party ${partyId} has ${count} no-response outcomes.`,
        explanation: "Repeated no-response suggests the current channel or cadence is ineffective.",
        severity: "medium",
        confidence: 0.84,
        confidenceReason: `Counted ${count} no-response interaction outcomes (threshold ${minCount}).`,
        evidence: [createEvidenceReference({
          objectType: "party",
          objectId: partyId,
          businessId,
          field: "noResponseCount",
          observedValue: count,
          comparison: ">=",
          threshold: minCount,
          observedAt: nowISO,
          explanation: `${count} recorded no-response outcomes.`,
        })],
        relatedObjectRefs: [{ objectType: "party", objectId: partyId }],
      });
    }
    return results;
  },

  obs_missing_required_information({ stack, businessId, nowISO }) {
    const results = [];
    for (const subject of stack.businessSubjectRuntime?.getSubjects?.() ?? []) {
      const required = subject.requiredFields ?? subject.metadata?.requiredFields ?? [];
      const missing = [];
      for (const field of required) {
        if (subject[field] == null && subject.attributes?.[field] == null && subject.presentation?.[field] == null) {
          missing.push(field);
        }
      }
      // Canonical signal: explicit incomplete flag or empty displayName on active subjects.
      if (!missing.length) {
        if (subject.status === "incomplete" || subject.metadata?.missingRequiredInformation) {
          missing.push(...(subject.metadata?.missingFields ?? ["required_information"]));
        } else if (!subject.displayName && !subject.title) {
          missing.push("displayName");
        } else {
          continue;
        }
      }
      results.push({
        subjectKey: `subject_incomplete:${subject.id}`,
        title: "Operational record missing required information",
        summary: `Subject ${subject.id} is missing: ${missing.join(", ")}.`,
        explanation: "Required presentation/operational fields are incomplete.",
        severity: "medium",
        confidence: 0.9,
        confidenceReason: "Canonical subject fields marked missing or incomplete.",
        evidence: [createEvidenceReference({
          objectType: "business_subject",
          objectId: subject.id,
          businessId,
          field: missing[0],
          observedValue: null,
          comparison: "is_null",
          observedAt: nowISO,
          explanation: `Missing required fields: ${missing.join(", ")}.`,
        })],
        missingEvidence: missing,
        relatedObjectRefs: [{ objectType: "business_subject", objectId: subject.id }],
      });
    }
    return results;
  },

  obs_integration_attention({ stack, businessId, nowISO }) {
    const results = [];
    const connections = stack.connectionRuntime?.listConnections?.()
      ?? stack.connectionRuntime?.getConnections?.()
      ?? [];
    for (const connection of connections) {
      const health = String(connection.health?.statusId ?? connection.status ?? "").toLowerCase();
      if (!/(fail|error|attention|degraded|disconnected)/.test(health)) continue;
      results.push({
        subjectKey: `integration:${connection.id}`,
        title: "Integration readiness/failure requiring attention",
        summary: `Integration ${connection.name ?? connection.id} needs attention (${health}).`,
        explanation: "Connection health indicates failure or degraded readiness.",
        severity: "high",
        confidence: 0.88,
        confidenceReason: `Connection health status is ${health}.`,
        evidence: [createEvidenceReference({
          objectType: "integration",
          objectId: connection.id,
          businessId,
          field: "health",
          observedValue: health,
          observedAt: nowISO,
          explanation: `Integration requires attention: ${health}.`,
        })],
        relatedObjectRefs: [{ objectType: "integration", objectId: connection.id }],
      });
    }
    return results;
  },

  obs_ai_employee_readiness_gap({ stack, businessId, nowISO }) {
    const results = [];
    const employees = stack.teamRuntime?.getMembers?.()?.filter((m) => m.kind === "digital" || m.type === "ai_employee")
      ?? [];
    for (const employee of employees) {
      const ready = employee.readiness?.status === "READY" || employee.operationalReady === true;
      if (ready) continue;
      results.push({
        subjectKey: `employee_gap:${employee.id}`,
        title: "AI Employee readiness gap",
        summary: `${employee.name ?? employee.id} is not operationally ready.`,
        explanation: "Digital employee lacks readiness requirements.",
        severity: "medium",
        confidence: 0.8,
        confidenceReason: "Team member readiness is not READY.",
        evidence: [createEvidenceReference({
          objectType: "employee",
          objectId: employee.id,
          businessId,
          field: "readiness",
          observedValue: employee.readiness?.status ?? "not_ready",
          observedAt: nowISO,
          explanation: "AI employee readiness gap detected.",
        })],
        relatedObjectRefs: [{ objectType: "employee", objectId: employee.id }],
      });
    }
    return results;
  },

  obs_repeated_workflow_failure({ stack, businessId, nowISO, thresholds }) {
    const minFailures = Number(thresholds?.minFailures ?? 2);
    const runs = stack.automationRuntime?.getRuns?.() ?? stack.automationRuntime?.listRuns?.() ?? [];
    const byWorkflow = new Map();
    for (const run of runs) {
      if (String(run.status).toLowerCase() !== "failed") continue;
      const key = run.workflowId ?? run.automationId ?? run.ruleId ?? run.id;
      byWorkflow.set(String(key), (byWorkflow.get(String(key)) ?? 0) + 1);
    }
    const results = [];
    for (const [workflowId, count] of byWorkflow.entries()) {
      if (count < minFailures) continue;
      results.push({
        subjectKey: `workflow_fail:${workflowId}`,
        title: "Repeated workflow failure",
        summary: `Workflow ${workflowId} failed ${count} times.`,
        explanation: "Repeated automation failures need owner review.",
        severity: "high",
        confidence: 0.86,
        confidenceReason: `Counted ${count} failed automation runs (threshold ${minFailures}).`,
        evidence: [createEvidenceReference({
          objectType: "workflow",
          objectId: workflowId,
          businessId,
          field: "failureCount",
          observedValue: count,
          comparison: ">=",
          threshold: minFailures,
          observedAt: nowISO,
          explanation: `Workflow failed ${count} times.`,
        })],
        relatedObjectRefs: [{ objectType: "workflow", objectId: workflowId }],
      });
    }
    return results;
  },

  obs_duplicate_operational_data({ stack, businessId, nowISO }) {
    const results = [];
    const parties = stack.businessGraphRuntime?.getParties?.() ?? [];
    const byEmail = new Map();
    for (const party of parties) {
      const email = String(party.email ?? party.primaryEmail ?? party.attributes?.email ?? "").toLowerCase();
      if (!email) continue;
      if (!byEmail.has(email)) byEmail.set(email, []);
      byEmail.get(email).push(party);
    }
    for (const [email, group] of byEmail.entries()) {
      if (group.length < 2) continue;
      results.push({
        subjectKey: `dup_party:${email}`,
        title: "Duplicate/conflicting operational data",
        summary: `${group.length} parties share email ${email}.`,
        explanation: "Canonical parties share the same email identity.",
        severity: "medium",
        confidence: 0.9,
        confidenceReason: "Multiple party records share the same email field.",
        evidence: group.map((party) => createEvidenceReference({
          objectType: "party",
          objectId: party.id,
          businessId,
          field: "email",
          observedValue: email,
          comparison: "duplicate",
          observedAt: nowISO,
          explanation: `Party ${party.displayName ?? party.id} shares email ${email}.`,
        })),
        relatedObjectRefs: group.map((party) => ({ objectType: "party", objectId: party.id })),
      });
    }
    return results;
  },
};
