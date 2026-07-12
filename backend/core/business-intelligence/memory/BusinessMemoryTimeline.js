import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";

/**
 * Business Memory Timeline — composes canonical events; not a separate source of truth.
 */
export function buildBusinessMemoryTimeline({
  intelligenceCandidateRuntime = null,
  workRuntime = null,
  interactionRuntime = null,
  approvalRuntime = null,
  auditEvents = [],
  limit = 50,
} = {}) {
  const events = [];

  for (const candidate of intelligenceCandidateRuntime?.getCandidates?.() ?? []) {
    events.push({
      at: candidate.detectedAt,
      kind: "intelligence_candidate_detected",
      label: `Detected: ${candidate.title}`,
      relatedId: candidate.id,
      detail: candidate.summary,
    });
    if (candidate.dismissedAt) {
      events.push({
        at: candidate.dismissedAt,
        kind: "intelligence_candidate_dismissed",
        label: `Dismissed: ${candidate.title}`,
        relatedId: candidate.id,
        detail: candidate.dismissalReason,
      });
    }
    if (candidate.resolvedAt) {
      events.push({
        at: candidate.resolvedAt,
        kind: "intelligence_candidate_resolved",
        label: `Resolved: ${candidate.title}`,
        relatedId: candidate.id,
        detail: null,
      });
    }
    if (candidate.convertedWorkId) {
      events.push({
        at: candidate.lastEvaluatedAt,
        kind: "intelligence_converted_to_work",
        label: `Converted to work ${candidate.convertedWorkId}`,
        relatedId: candidate.id,
        detail: candidate.convertedWorkId,
      });
    }
    if (candidate.architectSessionId) {
      events.push({
        at: candidate.lastEvaluatedAt,
        kind: "intelligence_converted_to_change_proposal",
        label: `Architect proposal ${candidate.architectSessionId}`,
        relatedId: candidate.id,
        detail: candidate.architectSessionId,
      });
    }
  }

  for (const work of workRuntime?.getWorkItems?.() ?? []) {
    events.push({
      at: work.updatedAt ?? work.createdAt,
      kind: "work_state",
      label: `Work ${work.title ?? work.id}: ${work.status}`,
      relatedId: work.id,
      detail: work.source ?? null,
    });
  }

  for (const interaction of interactionRuntime?.getInteractions?.() ?? []) {
    events.push({
      at: interaction.occurredAt ?? interaction.createdAt,
      kind: "interaction_outcome",
      label: `Interaction ${interaction.outcome ?? interaction.type ?? interaction.id}`,
      relatedId: interaction.id,
      detail: interaction.outcome ?? null,
    });
  }

  for (const approval of approvalRuntime?.getRequests?.() ?? []) {
    events.push({
      at: approval.updatedAt ?? approval.createdAt,
      kind: "approval_decision",
      label: `Approval ${approval.title ?? approval.id}: ${approval.status}`,
      relatedId: approval.id,
      detail: approval.status,
    });
  }

  for (const audit of auditEvents ?? []) {
    events.push({
      at: audit.createdAt ?? audit.at,
      kind: audit.action ?? "audit",
      label: String(audit.action ?? "audit"),
      relatedId: audit.targetId ?? null,
      detail: null,
    });
  }

  const sorted = events
    .filter((entry) => entry.at)
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
    .slice(0, limit)
    .map((entry) => deepFreeze(entry));

  return deepFreeze({
    generatedAt: new Date().toISOString(),
    events: sorted,
  });
}

/**
 * Memory facts Architect can state without inventing business data.
 */
export function explainCandidateMemory({ candidate, workRuntime = null, memoryTimeline = null } = {}) {
  const facts = [];
  if (!candidate) return deepFreeze({ facts: [], missingEvidence: ["candidate"] });

  if (candidate.dismissalReason) {
    facts.push(`Previously dismissed: ${candidate.dismissalReason}`);
  }
  if (candidate.convertedWorkId) {
    const work = workRuntime?.getWorkItem?.(candidate.convertedWorkId);
    if (work) {
      facts.push(`Work ${work.id} already exists with status ${work.status}.`);
    } else {
      facts.push(`Candidate was previously converted to work ${candidate.convertedWorkId}.`);
    }
  }
  if (candidate.architectSessionId) {
    facts.push(`An Architect change proposal session was seeded (${candidate.architectSessionId}).`);
  }
  if (candidate.status === "RESOLVED") {
    facts.push("This candidate was resolved after a recorded outcome or cleared condition.");
  }

  const related = (memoryTimeline?.events ?? []).filter((entry) => entry.relatedId === candidate.id);
  for (const entry of related.slice(0, 5)) {
    facts.push(entry.label);
  }

  return deepFreeze({
    facts,
    missingEvidence: candidate.missingEvidence ?? [],
  });
}
