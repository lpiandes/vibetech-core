import { deepFreeze } from "../workspace/_utils/deepFreeze.js";
import { createEntityRef, ENTITY_TYPES } from "../references/EntityRef.js";

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

  for (const candidate of safeArray(intelligenceCandidateRuntime?.getOpenCandidates?.())) {
    items.push({
      id: `attention_intelligence_${candidate.id}`,
      title: candidate.title,
      summary: candidate.summary,
      reason: candidate.confidenceReason,
      businessImpact: candidate.explanation,
      priority: candidate.severity === "critical" ? "critical"
        : candidate.severity === "high" ? "high"
          : "medium",
      dueAt: null,
      waitingDuration: null,
      sourceType: "intelligence_candidate",
      sourceId: String(candidate.id),
      intelligenceCandidateId: candidate.id,
      partyId: candidate.relatedObjectRefs?.find((ref) => ref.objectType === "party")?.objectId ?? null,
      partyName: partyName(
        businessGraphRuntime,
        candidate.relatedObjectRefs?.find((ref) => ref.objectType === "party")?.objectId,
      ),
      subjectName: subjectName(
        businessSubjectRuntime,
        candidate.relatedObjectRefs?.find((ref) => ref.objectType === "business_subject")?.objectId,
      ),
      recommendedAction: candidate.recommendedActions?.[0]?.label ?? "Review evidence and decide.",
      availableActions: [
        { id: "create_work", label: "Create Work", kind: "create_work" },
        { id: "propose_change", label: "Propose Change", kind: "create_architect_change_proposal" },
        { id: "ask_architect", label: "Ask Architect", href: "/architect" },
        { id: "dismiss", label: "Dismiss", kind: "dismiss" },
      ],
      relatedObjects: safeArray(candidate.relatedObjectRefs).map((ref) => (
        createEntityRef({ entityType: ref.objectType, entityId: String(ref.objectId) })
      )),
      evidence: candidate.evidence,
      confidenceReason: candidate.confidenceReason,
      explanation: candidate.explanation,
      status: candidate.status,
    });
  }

  for (const approval of safeArray(approvalRuntime?.getRequests?.()).filter((a) => a.status === "PENDING")) {
    const relatedWork = safeArray(workRuntime?.getWorkItems?.()).find(
      (w) => String(w.id) === String(approval.relatedWorkId ?? approval.workId ?? ""),
    );
    const relatedRequest = safeArray(requestRuntime?.getRequests?.()).find(
      (r) => String(r.id) === String(relatedWork?.requestId ?? approval.requestId ?? ""),
    );
    const partyId = relatedWork?.requestedBy ?? approval.requesterId ?? relatedRequest?.requester ?? null;
    const party = partyName(businessGraphRuntime, partyId);
    const subjectId = relatedRequest?.subjectRefs?.[0]?.entityId;
    const subject = subjectName(businessSubjectRuntime, subjectId);
    const approvalId = String(approval.id);

    items.push({
      id: `attention_approval_${approvalId}`,
      title: party ? `Approve send to ${party}` : `Approve: ${approval.title ?? "outbound message"}`,
      summary: subject
        ? `Owner approval for ${subject} — ${approval.description ?? approval.title ?? "authorization required"}`
        : approval.description ?? `Customer-facing send needs your approval before it leaves the building.`,
      reason: "Automation without silent outbound. Owners supervise; AI executes approved work.",
      businessImpact: "Work cannot continue until approved.",
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
      workHref: relatedWork?.id && presentation?.businessId
        ? `/b/${presentation.businessId}/work?workId=${encodeURIComponent(String(relatedWork.id))}`
        : null,
      knowledgeCited: Array.isArray(approval.metadata?.knowledgeCited)
        ? approval.metadata.knowledgeCited.map(String)
        : Array.isArray(relatedWork?.metadata?.sourceRefs)
          ? relatedWork.metadata.sourceRefs.map((ref) => String(ref.title ?? ref.id ?? ref)).filter(Boolean)
          : [],
      requestedBy: approval.requestedBy ?? approval.requesterId ?? "AI teammate",
      requestedAt: approval.requestedAt ?? approval.createdAt ?? null,
      recommendedAction: "Approve the prepared response if it aligns with your policies.",
      availableActions: [
        { id: "approve", label: "Approve", mutation: { type: "approval_decision", approvalId, decision: "GRANT" } },
        { id: "reject", label: "Reject", mutation: { type: "approval_decision", approvalId, decision: "REJECT" } },
        {
          id: "review_approval",
          label: "Open Work",
          href: relatedWork?.id ? `/work?workId=${encodeURIComponent(String(relatedWork.id))}` : "/work",
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
      availableActions: [{ id: "review_automations", label: "Review automations", href: "/automations" }],
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
