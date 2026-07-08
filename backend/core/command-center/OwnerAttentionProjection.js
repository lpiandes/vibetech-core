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
} = {}) {
  const items = [];

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
      title: party ? `${party}` : `Approve: ${approval.title ?? "owner authorization"}`,
      summary: subject
        ? `Owner response for ${subject} — ${approval.description ?? approval.title ?? "authorization required"}`
        : approval.description ?? `Authorization required before external communication.`,
      reason: "External communication requires authorization.",
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
      recommendedAction: "Approve the prepared response if it aligns with your policies.",
      availableActions: [
        { id: "approve", label: "Approve", mutation: { type: "approval_decision", approvalId, decision: "GRANT" } },
        { id: "reject", label: "Reject", mutation: { type: "approval_decision", approvalId, decision: "REJECT" } },
        { id: "review_approval", label: "Review details", href: "/attention" },
      ],
      relatedObjects: [createEntityRef({ entityType: "Approval", entityId: approvalId })],
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
    items.push({
      id: `attention_conn_${conn.id}`,
      title: `Connect ${conn.displayName} for production`,
      summary: conn.purpose || "Production provider setup required.",
      reason: "Real business provider is not yet connected.",
      businessImpact: "Live communications and integrations remain unavailable.",
      priority: "medium",
      dueAt: null,
      sourceType: "connection",
      sourceId: String(conn.id),
      recommendedAction: "Complete production provider setup in Connections.",
      availableActions: [{ id: "connect_system", label: "Open connections", href: "/connections" }],
      relatedObjects: [createEntityRef({ entityType: "Connection", entityId: String(conn.id) })],
    });
  }

  void connectionDependencyProjection;
  void employeeReadinessReport;
  void readinessReport;
  void integrationPlatform;
  void presentation;

  return deepFreeze(sortAttentionItems(items));
}
