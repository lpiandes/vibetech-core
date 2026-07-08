import { deepFreeze } from "../workspace/_utils/deepFreeze.js";

import { ENGAGEMENT_VIEW_VERSION } from "./EngagementDefaults.js";
import { createEngagementViewModel } from "./EngagementViewModel.js";
import { validateEngagementViewModel } from "./EngagementValidator.js";
import { buildEngagementTimeline, collectPartyContext } from "./EngagementTimelineBuilder.js";
import { buildEngagementFollowUps } from "./EngagementFollowUpProjection.js";
import { buildEngagementAttention } from "./EngagementAttentionEngine.js";
import { buildEngagementNextActions } from "./EngagementNextActionProjection.js";
import { ENTITY_TYPES } from "../references/EntityRef.js";
import { projectSegmentMembership } from "../segments/SegmentProjectionEngine.js";
import { checkCommunicationPermitted } from "../communications/preferences/CommunicationPreferenceEnforcer.js";
import { formatBusinessDate } from "../presentation/formatBusinessDate.js";

function fail(message) {
  throw new Error(`EngagementViewAdapter: ${message}`);
}

function safeArray(v) {
  return Array.isArray(v) ? v : [];
}

function isOpenWorkStatus(status) {
  return !["completed", "cancelled", "closed"].includes(String(status ?? ""));
}

function isOpenRequestStatus(status) {
  return !["closed", "cancelled", "rejected"].includes(String(status ?? ""));
}

function collectPartySubjects({ partyId, businessGraphRuntime, businessSubjectRuntime, requests, interactions }) {
  if (!businessSubjectRuntime) return [];
  const pid = String(partyId);
  const subjectIds = new Set();
  for (const rel of safeArray(businessGraphRuntime?.getRelationships?.())) {
    const from = rel?.fromEntity;
    const to = rel?.toEntity;
    if (String(from?.entityType) === ENTITY_TYPES.PARTY && String(from?.entityId) === pid && String(to?.entityType) === ENTITY_TYPES.SUBJECT) {
      subjectIds.add(String(to.entityId));
    }
    if (String(to?.entityType) === ENTITY_TYPES.PARTY && String(to?.entityId) === pid && String(from?.entityType) === ENTITY_TYPES.SUBJECT) {
      subjectIds.add(String(from.entityId));
    }
  }
  for (const request of safeArray(requests)) {
    for (const ref of safeArray(request?.subjectRefs)) {
      if (String(ref?.entityType) === ENTITY_TYPES.SUBJECT && ref?.entityId) {
        subjectIds.add(String(ref.entityId));
      }
    }
  }
  for (const interaction of safeArray(interactions)) {
    for (const ref of safeArray(interaction?.relatedObjects)) {
      if (String(ref?.entityType) === ENTITY_TYPES.SUBJECT && ref?.entityId) {
        subjectIds.add(String(ref.entityId));
      }
    }
  }
  return [...subjectIds]
    .map((id) => businessSubjectRuntime.getSubject(id))
    .filter(Boolean);
}

function collectPartySegmentMemberships({
  partyId,
  segmentDefinitionRuntime,
  businessGraphRuntime,
  requestRuntime,
  interactionRuntime,
  businessSubjectRuntime,
  preferenceRuntime,
}) {
  if (!segmentDefinitionRuntime) return [];
  const pid = String(partyId);
  const memberships = [];
  for (const definition of segmentDefinitionRuntime.getDefinitions()) {
    if (String(definition.status) !== "active") continue;
    const projection = projectSegmentMembership({
      segmentDefinition: definition,
      businessGraphRuntime,
      requestRuntime,
      interactionRuntime,
      businessSubjectRuntime,
      preferenceRuntime,
    });
    const member = projection.members.find((m) => String(m.entityId) === pid);
    if (!member) continue;
    const explanation = projection.explanations.find((e) => String(e.entityId) === pid);
    memberships.push(
      deepFreeze({
        segmentId: String(definition.id),
        segmentName: String(definition.name),
        reasons: deepFreeze(Array.isArray(explanation?.reasons) ? explanation.reasons : []),
      }),
    );
  }
  return memberships;
}

function buildCommunicationPreferenceSummary({ partyId, preferenceRuntime }) {
  if (!preferenceRuntime) return deepFreeze({ items: [], contactable: { email: true, sms: true } });
  const items = safeArray(preferenceRuntime.getPreferencesForParty(partyId));
  const emailCheck = checkCommunicationPermitted({ preferenceRuntime, partyId, channel: "email" });
  const smsCheck = checkCommunicationPermitted({ preferenceRuntime, partyId, channel: "sms" });
  return deepFreeze({
    items: deepFreeze(items),
    contactable: deepFreeze({
      email: emailCheck.permitted,
      sms: smsCheck.permitted,
    }),
  });
}

function relationshipLabel(presentation, relationshipType) {
  const key = String(relationshipType ?? "");
  if (key === "REQUESTED_BY") return null;
  return presentation?.relationshipLabels?.[key] ?? key.replace(/_/g, " ").toLowerCase();
}

function workTypeLabel(presentation, workType) {
  const key = String(workType ?? "");
  return presentation?.workTypeLabels?.[key] ?? presentation?.requestTypeLabels?.[key] ?? key.replace(/_/g, " ");
}

function assigneeLabel(teamRuntime, assigneeId) {
  const id = String(assigneeId ?? "");
  if (!id || id === "unassigned" || id === "tm_system") return null;
  const m = safeArray(teamRuntime?.getMembers?.()).find((x) => String(x.id) === id);
  if (!m || m.metadata?.seeded) return null;
  return String(m.name);
}

function enrichOpenWork({ workItems, teamRuntime, requestRuntime, businessSubjectRuntime, presentation }) {
  return safeArray(workItems).map((w) => {
    const request = w.requestId ? requestRuntime?.getRequest?.(w.requestId) : null;
    const subjectId = request?.subjectRefs?.[0]?.entityId ?? null;
    const subjectName = subjectId ? businessSubjectRuntime?.getSubject?.(String(subjectId))?.displayName ?? null : null;
    return deepFreeze({
      ...w,
      workTypeLabel: workTypeLabel(presentation, w.workType),
      assigneeName: assigneeLabel(teamRuntime, w.assignedTo),
      subjectName,
      statusLabel: presentation?.workStatusLabels?.[String(w.status)] ?? String(w.status).replace(/_/g, " "),
    });
  });
}

function buildQualificationSummary(requests) {
  return deepFreeze(
    safeArray(requests)
      .filter((r) => r.inboundAttribution || r.metadata?.qualification)
      .map((r) =>
        deepFreeze({
          requestId: String(r.id),
          requestType: String(r.requestType ?? ""),
          inboundAttribution: r.inboundAttribution ?? null,
          qualification: r.metadata?.qualification ?? null,
        }),
      ),
  );
}

export class EngagementViewAdapter {
  constructor({ nowISO } = {}) {
    this.nowISO = String(nowISO ?? "2026-07-01T00:00:00.000Z");
  }

  translate({
    partyId,
    businessGraphRuntime,
    requestRuntime,
    workRuntime,
    communicationRuntime,
    interactionRuntime,
    automationRuntime,
    approvalRuntime,
    platformEventStore,
    analyticsRuntime,
    businessSubjectRuntime = null,
    communicationPreferenceRuntime = null,
    segmentDefinitionRuntime = null,
    teamRuntime = null,
    presentation = null,
  } = {}) {
    if (!partyId) fail("partyId required.");
    if (!businessGraphRuntime) fail("businessGraphRuntime required.");

    const party = businessGraphRuntime.getParty(partyId);
    if (!party) fail(`party not found: ${String(partyId)}`);

    const ctx = collectPartyContext({
      partyId,
      businessGraphRuntime,
      requestRuntime,
      workRuntime,
      communicationRuntime,
      interactionRuntime,
      automationRuntime,
      approvalRuntime,
    });

    const timeline = buildEngagementTimeline({
      partyId,
      businessGraphRuntime,
      requestRuntime,
      workRuntime,
      communicationRuntime,
      interactionRuntime,
      automationRuntime,
      approvalRuntime,
      platformEventStore,
      businessSubjectRuntime,
    });

    const followUps = buildEngagementFollowUps({
      interactions: ctx.interactions,
      workItems: ctx.workItems,
      automationRuns: ctx.automationRuns,
      approvals: ctx.approvals,
      partyId,
      nowISO: this.nowISO,
    });

    const pendingApprovals = ctx.approvals.filter((a) => String(a.status) === "PENDING");

    const attentionItems = buildEngagementAttention({
      partyId,
      followUps,
      messages: ctx.messages,
      workItems: ctx.workItems,
      approvals: ctx.approvals,
      automationRuns: ctx.automationRuns,
      interactions: ctx.interactions,
    });

    const nextActions = buildEngagementNextActions({
      partyId,
      followUps,
      workItems: ctx.workItems,
      approvals: ctx.approvals,
      messages: ctx.messages,
      automationRuns: ctx.automationRuns,
    });

    const relationshipSummary = safeArray(businessGraphRuntime.getRelationships())
      .filter((rel) => {
        const pid = String(partyId);
        return (
          (String(rel?.toEntity?.entityType) === "Party" && String(rel?.toEntity?.entityId) === pid) ||
          (String(rel?.fromEntity?.entityType) === "Party" && String(rel?.fromEntity?.entityId) === pid)
        );
      })
      .map((rel) =>
        deepFreeze({
          ...rel,
          relationshipLabel: relationshipLabel(presentation, rel.relationshipType),
        }),
      )
      .filter((rel) => rel.relationshipLabel);

    const openWork = enrichOpenWork({
      workItems: ctx.workItems.filter((w) => isOpenWorkStatus(w.status)),
      teamRuntime,
      requestRuntime,
      businessSubjectRuntime,
      presentation,
    });
    const openRequests = ctx.requests.filter((r) => isOpenRequestStatus(r.status)).map((r) =>
      deepFreeze({
        ...r,
        requestTypeLabel:
          presentation?.requestTypeLabels?.[String(r.requestType)] ?? String(r.requestType).replace(/_/g, " "),
      }),
    );

    const subjects = collectPartySubjects({
      partyId,
      businessGraphRuntime,
      businessSubjectRuntime,
      requests: ctx.requests,
      interactions: ctx.interactions,
    });
    const communicationPreferences = buildCommunicationPreferenceSummary({
      partyId,
      preferenceRuntime: communicationPreferenceRuntime,
    });
    const segmentMemberships = collectPartySegmentMemberships({
      partyId,
      segmentDefinitionRuntime,
      businessGraphRuntime,
      requestRuntime,
      interactionRuntime,
      businessSubjectRuntime,
      preferenceRuntime: communicationPreferenceRuntime,
    });
    const qualificationSummary = buildQualificationSummary(ctx.requests);

    const currentContext = deepFreeze({
      primaryRequestId: openRequests[0]?.id ?? ctx.requests[0]?.id ?? null,
      primaryWorkItemId: openWork[0]?.id ?? ctx.workItems[0]?.id ?? null,
      latestInteractionId: ctx.interactions[ctx.interactions.length - 1]?.id ?? null,
      pendingApprovalCount: pendingApprovals.length,
      overdueFollowUpCount: followUps.filter((f) => String(f.status) === "overdue").length,
    });

    const viewModel = createEngagementViewModel({
      version: ENGAGEMENT_VIEW_VERSION,
      partyId: String(partyId),
      generatedAt: this.nowISO,
      party,
      relationshipSummary,
      currentContext,
      timeline: timeline.map((item) =>
        deepFreeze({
          ...item,
          occurredAtLabel: formatBusinessDate(item.occurredAt, { nowISO: this.nowISO }) ?? item.occurredAt,
        }),
      ),
      openWork,
      openRequests,
      communications: ctx.messages,
      interactions: ctx.interactions,
      followUps,
      pendingApprovals,
      automationActivity: ctx.automationRuns,
      attention: deepFreeze({
        summary: attentionItems.length ? `${attentionItems.length} item(s) require attention.` : "No evidence-backed attention items.",
        items: attentionItems,
      }),
      nextActions,
      subjects,
      communicationPreferences,
      segmentMemberships,
      qualificationSummary,
      metrics: deepFreeze({
        interactionCount: ctx.interactions.length,
        communicationCount: ctx.messages.length,
        openWorkCount: openWork.length,
        openRequestCount: openRequests.length,
        followUpCount: followUps.length,
        automationRunCount: ctx.automationRuns.length,
        subjectCount: subjects.length,
        segmentMembershipCount: segmentMemberships.length,
        analyticsDataPointCount: analyticsRuntime?.getDataPoints?.()?.length ?? 0,
      }),
      metadata: deepFreeze({ readModel: true, source: "engagement_view_adapter" }),
    });

    validateEngagementViewModel(viewModel);
    return viewModel;
  }
}
