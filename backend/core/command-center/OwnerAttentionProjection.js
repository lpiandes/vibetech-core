import { deepFreeze } from "../workspace/_utils/deepFreeze.js";
import { createEntityRef, ENTITY_TYPES } from "../references/EntityRef.js";
import { buildSpecialtyDraftGlance } from "../ai-builder/specialty/buildSpecialtyDraftGlance.js";

function safeArray(v) {
  return Array.isArray(v) ? v : [];
}

function priorityRank(p) {
  const order = { critical: 0, high: 1, medium: 2, low: 3 };
  return order[String(p).toLowerCase()] ?? 2;
}

function sortAttentionItems(items) {
  return items.slice().sort((a, b) => {
    const pr = priorityRank(a.priority) - priorityRank(b.priority);
    if (pr !== 0) return pr;
    const da = a.dueAt ? new Date(a.dueAt).getTime() : Number.MAX_SAFE_INTEGER;
    const db = b.dueAt ? new Date(b.dueAt).getTime() : Number.MAX_SAFE_INTEGER;
    return da - db;
  });
}

function partyName(businessGraphRuntime, partyId) {
  return businessGraphRuntime?.getParty?.(String(partyId))?.displayName ?? null;
}

function subjectName(businessSubjectRuntime, subjectId) {
  return businessSubjectRuntime?.getSubject?.(String(subjectId))?.displayName ?? null;
}

function hoursWaiting(occurredAt, nowISO) {
  if (!occurredAt || !nowISO) return null;
  const hrs = Math.floor((new Date(nowISO).getTime() - new Date(occurredAt).getTime()) / (60 * 60 * 1000));
  if (hrs < 1) return "less than an hour";
  if (hrs === 1) return "1 hour";
  return `${hrs} hours`;
}

function buildApprovalEvidence({
  approval,
  relatedWork,
  party,
  subject,
  bodyPreview,
  subjectLine,
}) {
  const evidence = [];
  const requestedAt = approval?.requestedAt ?? approval?.createdAt ?? null;
  if (requestedAt) {
    evidence.push({
      kind: "approval_requested_at",
      detail: `Approval requested at ${requestedAt}`,
      source: "approval",
    });
  }
  if (subjectLine) {
    evidence.push({ kind: "message_subject", detail: subjectLine, source: "approval.context" });
  }
  if (bodyPreview) {
    evidence.push({
      kind: "message_preview",
      detail: bodyPreview.slice(0, 180),
      source: "approval.context",
    });
  }
  const channel = approval?.channel ?? approval?.metadata?.channel ?? approval?.capability ?? null;
  if (channel) {
    evidence.push({ kind: "channel", detail: String(channel), source: "approval" });
  }
  if (party) {
    evidence.push({ kind: "contact", detail: String(party), source: "business_graph" });
  }
  if (subject) {
    evidence.push({ kind: "subject", detail: String(subject), source: "business_subject" });
  }
  const providerId =
    approval?.context?.providerId
    ?? approval?.metadata?.providerId
    ?? relatedWork?.metadata?.providerId
    ?? relatedWork?.metadata?.gmailMessageId
    ?? null;
  if (providerId) {
    evidence.push({
      kind: String(approval?.context?.evidenceKind ?? relatedWork?.metadata?.evidenceKind ?? "provider_id"),
      providerId: String(providerId),
      source: "provider",
    });
  }
  for (const ref of safeArray(relatedWork?.metadata?.sourceRefs).slice(0, 4)) {
    evidence.push({
      kind: "knowledge_ref",
      detail: String(ref.title ?? ref.id ?? ref),
      source: "work.metadata",
    });
  }
  return evidence;
}

/**
 * Deterministic owner-attention projection from canonical facts only.
 */
export function projectOwnerAttention({
  approvalRuntime,
  workRuntime,
  requestRuntime,
  businessGraphRuntime,
  businessSubjectRuntime,
  readinessReport,
  connectedSystemsSnapshot,
  employeeReadinessReport,
  automationRuntime,
  connectionDependencyProjection,
  integrationPlatform,
  presentation,
  nowISO,
  intelligenceCandidateRuntime = null,
} = {}) {
  const items = [];

  // BI / intelligence candidates are NOT Decisions — they live under Architect recommendations.
  // Do not push intelligence_candidate into the owner judgment queue.
  void intelligenceCandidateRuntime;

  for (const approval of safeArray(approvalRuntime?.getRequests?.()).filter((a) => a.status === "PENDING")) {
    const workIdFromApproval = String(
      approval.relatedWorkId
      ?? approval.workId
      ?? approval.sourceReference?.workItemId
      ?? approval.context?.workItemId
      ?? "",
    );
    const relatedWork = safeArray(workRuntime?.getWorkItems?.()).find(
      (w) => String(w.id) === workIdFromApproval,
    );
    const relatedRequest = safeArray(requestRuntime?.getRequests?.()).find(
      (r) => String(r.id) === String(relatedWork?.requestId ?? approval.requestId ?? ""),
    );
    const partyId = relatedWork?.requestedBy ?? approval.requesterId ?? relatedRequest?.requester ?? null;
    const party = partyName(businessGraphRuntime, partyId);
    const subjectId = relatedRequest?.subjectRefs?.[0]?.entityId;
    const subject = subjectName(businessSubjectRuntime, subjectId);
    const approvalId = String(approval.id);
    const glance = relatedWork?.metadata?.glance ?? (relatedWork ? buildSpecialtyDraftGlance({
      employee: {
        displayName: relatedWork.metadata?.employeeDisplayName
          ?? relatedWork.metadata?.employeeName
          ?? relatedWork.assigneeName
          ?? null,
      },
      triggerLabel: relatedWork.metadata?.triggerLabel ?? null,
      triggerEventType: relatedWork.metadata?.triggerEventType ?? null,
      eventPayload: relatedWork.metadata?.eventPayload
        ?? relatedWork.metadata?.personalization
        ?? relatedWork.metadata?.contact
        ?? null,
      brief: relatedWork.metadata?.brief ?? relatedWork.description ?? "",
      artifact: relatedWork.metadata?.artifact ?? null,
      approvalIds: [approvalId],
      businessId: presentation?.businessId ?? null,
      workId: workIdFromApproval || null,
    }) : null);
    const bodyPreview = String(approval.context?.bodyPreview ?? "").trim();
    const subjectLine = String(approval.context?.subject ?? "").trim();
    const evidence = buildApprovalEvidence({
      approval,
      relatedWork,
      party,
      subject,
      bodyPreview,
      subjectLine,
    });
    const workHref = glance?.workHref
      || (relatedWork?.id && presentation?.businessId
        ? `/b/${presentation.businessId}/work?workId=${encodeURIComponent(String(relatedWork.id))}`
        : null);
    const bizBase = presentation?.businessId ? `/b/${presentation.businessId}` : "";

    items.push({
      id: `attention_approval_${approvalId}`,
      title: glance?.title
        || (party
          ? `Approve send to ${party}`
          : `Approve: ${(approval.title ?? subjectLine) || "outbound message"}`),
      summary: glance?.summary
        || (bodyPreview
          ? bodyPreview.slice(0, 120)
          : subject
            ? `Owner approval for ${subject} — ${approval.description ?? approval.title ?? "authorization required"}`
            : approval.description ?? `Customer-facing send needs your approval before it leaves the building.`),
      reason: glance?.whyNeedsYou
        || "High-impact outbound cannot leave without your judgment under the Operating Contract.",
      businessImpact: "Work cannot continue until approved — SLA clock may be running.",
      priority: "critical",
      dueAt: approval.dueAt ?? null,
      waitingDuration: hoursWaiting(approval.requestedAt ?? approval.createdAt, nowISO),
      sourceType: "approval",
      sourceId: approvalId,
      approvalId,
      partyId,
      partyName: party,
      subjectName: subject,
      channel: approval.channel ?? approval.metadata?.channel ?? approval.capability ?? null,
      workId: relatedWork?.id ? String(relatedWork.id) : null,
      workHref,
      evidence,
      ifApproved: "VIBETech sends the prepared message, records proof, and continues the Operating Contract.",
      ifRejected: "Outbound is blocked; the opportunity stays open for your alternative instruction.",
      knowledgeCited: Array.isArray(approval.metadata?.knowledgeCited)
        ? approval.metadata.knowledgeCited.map(String)
        : Array.isArray(relatedWork?.metadata?.sourceRefs)
          ? relatedWork.metadata.sourceRefs.map((ref) => String(ref.title ?? ref.id ?? ref)).filter(Boolean)
          : [],
      requestedBy: approval.requestedBy ?? approval.requesterId ?? "Revenue Follow-Through",
      requestedAt: approval.requestedAt ?? approval.createdAt ?? null,
      recommendedAction: bodyPreview
        ? `Send prepared response${party ? ` to ${party}` : ""}.`
        : (glance?.whyNeedsYou || "Approve the prepared response if it aligns with your policies."),
      availableActions: [
        { id: "approve", label: "Approve and send", mutation: { type: "approval_decision", approvalId, decision: "GRANT" } },
        {
          id: "edit",
          label: "Edit",
          href: workHref || (bizBase ? `${bizBase}/work` : "/work"),
        },
        {
          id: "assign",
          label: "Assign only",
          href: bizBase ? `${bizBase}/work` : "/work",
        },
        { id: "reject", label: "Reject", mutation: { type: "approval_decision", approvalId, decision: "REJECT" } },
        {
          id: "review_approval",
          label: "Open Work",
          href: relatedWork?.id && bizBase
            ? `${bizBase}/work?workId=${encodeURIComponent(String(relatedWork.id))}`
            : (bizBase ? `${bizBase}/work` : "/work"),
        },
      ],
      relatedObjects: [createEntityRef({ entityType: "Approval", entityId: approvalId })],
      audit: {
        approvalId,
        channel: approval.channel ?? approval.metadata?.channel ?? null,
        requestedBy: approval.requestedBy ?? approval.requesterId ?? null,
        requestedAt: approval.requestedAt ?? approval.createdAt ?? null,
        knowledgeCited: Array.isArray(approval.metadata?.knowledgeCited)
          ? approval.metadata.knowledgeCited.map(String)
          : [],
        winClaim: "Every customer email/SMS/call has an approval event.",
      },
    });
  }

  // Specialty automation drafts — generic glance cards for Home "Needs you".
  const pendingApprovalWorkIds = new Set(
    items
      .filter((item) => item.sourceType === "approval" && item.workId)
      .map((item) => String(item.workId)),
  );
  for (const work of safeArray(workRuntime?.getWorkItems?.())) {
    const workType = String(work?.workType ?? "");
    const isSpecialty = work?.metadata?.customAi === true || workType === "custom_ai_task";
    if (!isSpecialty) continue;
    if (work.status === "completed" || work.status === "cancelled") continue;
    const workId = String(work.id ?? "");
    if (!workId || pendingApprovalWorkIds.has(workId)) continue;
    // Pure Auto runs stay out of Needs you.
    if (work.metadata?.needsYou === false || work.metadata?.glance?.needsYou === false) continue;

    const glance = work.metadata?.glance ?? buildSpecialtyDraftGlance({
      employee: {
        displayName: work.metadata?.employeeDisplayName
          ?? work.metadata?.employeeName
          ?? work.assigneeName
          ?? null,
      },
      triggerLabel: work.metadata?.triggerLabel ?? null,
      triggerEventType: work.metadata?.triggerEventType ?? null,
      eventPayload: work.metadata?.eventPayload ?? work.metadata?.personalization ?? work.metadata?.contact ?? null,
      brief: work.metadata?.brief ?? work.description ?? "",
      artifact: work.metadata?.artifact ?? null,
      approvalIds: Array.isArray(work.metadata?.approvalIds) ? work.metadata.approvalIds : [],
      businessId: presentation?.businessId ?? null,
      workId,
    });
    const waiting = hoursWaiting(work.createdAt ?? work.updatedAt, nowISO);
    const title = glance?.title || String(work.title ?? "Draft ready for review");
    const summary = glance?.summary
      || String(work.metadata?.triggerLabel ?? work.metadata?.triggerEventType ?? "Automation drafted something for you");
    const why = glance?.whyNeedsYou || "Review the draft, then continue.";
    const href = glance?.workHref
      || (presentation?.businessId
        ? `/b/${presentation.businessId}/work?workId=${encodeURIComponent(workId)}`
        : `/work?workId=${encodeURIComponent(workId)}`);

    items.push({
      id: `attention_specialty_draft_${workId}`,
      title,
      summary: waiting ? `${summary} · waiting ${waiting}` : summary,
      reason: why,
      businessImpact: why,
      priority: "high",
      dueAt: work.dueAt ?? null,
      waitingDuration: waiting,
      sourceType: "specialty_draft",
      sourceId: workId,
      workId,
      workHref: href,
      partyName: work.metadata?.contact?.name ?? work.metadata?.eventPayload?.name ?? null,
      recommendedAction: why,
      availableActions: [
        { id: "review_draft", label: "Open draft", href },
      ],
      relatedObjects: [createEntityRef({ entityType: ENTITY_TYPES.WORK, entityId: workId })],
    });
  }

  for (const work of safeArray(workRuntime?.getWorkItems?.()).filter(
    (w) => (w.priority === "urgent" || String(w.workType) === "showing_coordination") && w.status !== "completed" && w.status !== "cancelled",
  )) {
    const request = work.requestId ? requestRuntime?.getRequest?.(work.requestId) : null;
    const partyId = work.requestedBy ?? request?.requester;
    const party = partyName(businessGraphRuntime, partyId);
    const subjectId = request?.subjectRefs?.[0]?.entityId;
    const subject = subjectName(businessSubjectRuntime, subjectId);
    const dueAt = work.dueAt ?? null;
    const overdue = dueAt && new Date(dueAt).getTime() < new Date(nowISO).getTime();
    const waiting = hoursWaiting(work.createdAt ?? work.updatedAt, nowISO);

    if (String(work.workType) === "showing_coordination" && work.status !== "blocked") {
      items.push({
        id: `attention_showing_${work.id}`,
        title: party && subject ? `${party} is waiting for a showing decision on ${subject}` : `Showing decision needed: ${work.title}`,
        summary: overdue
          ? `Showing coordination is overdue${waiting ? ` — open for ${waiting}` : ""}.`
          : `Confirm tour scheduling${waiting ? ` · waiting ${waiting}` : ""}.`,
        reason: "Prospect qualification is complete; scheduling needs confirmation.",
        businessImpact: "Delay risks losing an interested prospect.",
        priority: overdue ? "critical" : "high",
        dueAt,
        waitingDuration: waiting,
        sourceType: "work",
        sourceId: String(work.id),
        partyId,
        partyName: party,
        subjectName: subject,
        recommendedAction: "Confirm showing time or assign follow-up.",
        availableActions: [
          { id: "review_work", label: "Open work", href: "/work" },
          { id: "view_party", label: "View person", href: partyId ? `/engagement/${partyId}` : "/engagement" },
        ],
        relatedObjects: [
          createEntityRef({ entityType: ENTITY_TYPES.WORK, entityId: String(work.id) }),
          partyId ? createEntityRef({ entityType: ENTITY_TYPES.PARTY, entityId: String(partyId) }) : null,
        ].filter(Boolean),
      });
      continue;
    }

    if (overdue) {
      items.push({
        id: `attention_work_${work.id}`,
        title: `Overdue: ${party ? `${party} — ` : ""}${work.title ?? work.id}`,
        summary: subject ? `${subject} · past due` : String(work.description ?? "High-priority work is past its due date."),
        reason: "Urgent work has not been completed on schedule.",
        businessImpact: "Service level and expectations may be at risk.",
        priority: "high",
        dueAt,
        waitingDuration: waiting,
        sourceType: "work",
        sourceId: String(work.id),
        partyId,
        partyName: party,
        subjectName: subject,
        recommendedAction: "Review work queue and ensure ownership.",
        availableActions: [{ id: "review_work", label: "Review work", href: "/work" }],
        relatedObjects: [createEntityRef({ entityType: ENTITY_TYPES.WORK, entityId: String(work.id) })],
      });
    }
  }

  for (const work of safeArray(workRuntime?.getWorkItems?.()).filter(
    (w) => String(w.workType) === "maintenance_coordination" && w.status === "blocked",
  )) {
    const partyId = work.requestedBy;
    const party = partyName(businessGraphRuntime, partyId);
    const subjectId = safeArray(requestRuntime?.getRequests?.()).find((r) => r.id === work.requestId)?.subjectRefs?.[0]?.entityId;
    const subject = subjectName(businessSubjectRuntime, subjectId);
    items.push({
      id: `attention_maint_blocked_${work.id}`,
      title: subject ? `Maintenance at ${subject} blocked` : `Maintenance blocked: ${work.title}`,
      summary: party ? `${party}'s request is waiting for vendor confirmation.` : "Waiting for vendor confirmation.",
      reason: "Maintenance coordination cannot proceed until vendor confirms.",
      businessImpact: "Resident issue remains unresolved.",
      priority: "high",
      dueAt: work.dueAt ?? null,
      sourceType: "work",
      sourceId: String(work.id),
      partyId,
      partyName: party,
      subjectName: subject,
      recommendedAction: "Follow up with vendor or reassign coordination.",
      availableActions: [{ id: "review_work", label: "Open work", href: "/work" }],
      relatedObjects: [createEntityRef({ entityType: ENTITY_TYPES.WORK, entityId: String(work.id) })],
    });
  }

  for (const run of safeArray(automationRuntime?.getRuns?.()).filter((r) => r.status === "FAILED")) {
    items.push({
      id: `attention_automation_failed_${run.id}`,
      title: "Automation could not complete",
      summary: String(run.definitionId ?? "A workflow encountered an error."),
      reason: "Configured automation failed during execution.",
      businessImpact: "Downstream work may not be created until resolved.",
      priority: "high",
      dueAt: null,
      sourceType: "automation",
      sourceId: String(run.id),
      recommendedAction: "Review automation configuration and connections.",
      availableActions: [{ id: "review_automations", label: "Review connections", href: "/integrations" }],
      relatedObjects: [createEntityRef({ entityType: "AutomationRun", entityId: String(run.id) })],
    });
  }

  for (const conn of safeArray(connectedSystemsSnapshot?.connections).filter(
    (c) => c.requirementLevel === "required" && c.status !== "CONNECTED" && !String(c.connectionLabel ?? "").includes("Demo connection active"),
  )) {
    const connId = String(conn.id);
    items.push({
      id: `attention_conn_${connId}`,
      title: `Connect ${conn.displayName}`,
      summary: conn.purpose || `${conn.displayName} must be connected before related features can run.`,
      reason: `${conn.displayName} is not connected yet.`,
      businessImpact: "Live communications and integrations remain unavailable until this connection is complete.",
      priority: "medium",
      dueAt: null,
      sourceType: "connection",
      sourceId: connId,
      recommendedAction: `Connect ${conn.displayName} in Integrations.`,
      availableActions: [{
        id: "connect_system",
        label: "Open Integrations",
        href: `/integrations?focus=${encodeURIComponent(connId)}`,
      }],
      relatedObjects: [createEntityRef({ entityType: "Connection", entityId: connId })],
    });
  }

  void connectionDependencyProjection;
  void employeeReadinessReport;
  void readinessReport;
  void integrationPlatform;
  void presentation;

  return deepFreeze(sortAttentionItems(items));
}
