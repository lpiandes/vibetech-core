import { deepFreeze } from "../workspace/_utils/deepFreeze.js";

import { FOLLOW_UP_STATUSES } from "./EngagementDefaults.js";
import { extractRelatedObjectRefs } from "./_utils/relatedObjectRefs.js";

function safeArray(v) {
  return Array.isArray(v) ? v : [];
}

function workLinkedToInteraction(workItems, interactionId) {
  const iid = String(interactionId);
  return safeArray(workItems).filter((w) => {
    const refs = extractRelatedObjectRefs(w.relatedObjects);
    return refs.interactionIds.includes(iid) || JSON.stringify(w.relatedObjects ?? []).includes(iid);
  });
}

export function buildEngagementFollowUps({ interactions, workItems, automationRuns, approvals, partyId, nowISO } = {}) {
  const nowMs = new Date(String(nowISO ?? "2026-07-01T00:00:00.000Z")).getTime();
  const followUps = [];

  for (const interaction of safeArray(interactions)) {
    if (!interaction.followUpAt) continue;

    const dueMs = new Date(String(interaction.followUpAt)).getTime();
    const status =
      Number.isFinite(dueMs) && dueMs < nowMs ? FOLLOW_UP_STATUSES.OVERDUE : FOLLOW_UP_STATUSES.UPCOMING;

    const linkedWork = workLinkedToInteraction(workItems, interaction.id);
    const linkedRuns = safeArray(automationRuns).filter((r) => String(r.triggerEventId ?? "").includes(String(interaction.id)));
    const pendingApproval = safeArray(approvals).some((a) => String(a.status) === "PENDING");

    followUps.push(
      deepFreeze({
        id: `follow_up_${interaction.id}`,
        interactionId: String(interaction.id),
        partyId: String(partyId),
        dueAt: String(interaction.followUpAt),
        status,
        ownerId: interaction.ownerId ?? null,
        outcome: interaction.outcome ?? null,
        nextStep: interaction.nextStep ?? null,
        relatedObjects: deepFreeze(interaction.relatedObjects ?? []),
        downstreamWorkIds: deepFreeze(linkedWork.map((w) => String(w.id))),
        automationRunIds: deepFreeze(linkedRuns.map((r) => String(r.id))),
        approvalPending: pendingApproval,
        metadata: deepFreeze({ derivedFrom: { interactionId: interaction.id } }),
      }),
    );
  }

  followUps.sort((a, b) => String(a.dueAt).localeCompare(String(b.dueAt)));
  return deepFreeze(followUps);
}
