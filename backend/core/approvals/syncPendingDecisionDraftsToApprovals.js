/**
 * Materialize installation.configuration.pendingDecisionDrafts into ApprovalRuntime
 * so they appear in Decisions with Approve / Reject.
 *
 * Idempotent: approval id = apr_<draft.id>. Does not invent sends — GRANT fulfillment
 * marks the draft approved and optionally sends when email/SMS adapters exist.
 */
import { deepFreeze } from "../workspace/_utils/deepFreeze.js";
import { createApprovalRequest } from "./ApprovalRequest.js";
import { APPROVAL_INTERNAL_EVENT_TYPES } from "./ApprovalEventTypes.js";

function safeArray(v) {
  return Array.isArray(v) ? v : [];
}

export function approvalIdForDecisionDraft(draftId) {
  return `apr_${String(draftId)}`;
}

/**
 * @returns {{ synced: number, approvalIds: string[] }}
 */
export function syncPendingDecisionDraftsToApprovals({
  approvalRuntime = null,
  pendingDecisionDrafts = [],
  businessId = null,
  nowISO = new Date().toISOString(),
  actorId = "decision_draft_sync",
} = {}) {
  if (!approvalRuntime?.applyEvent || typeof approvalRuntime.getRequestById !== "function") {
    return deepFreeze({ synced: 0, approvalIds: [] });
  }

  const at = typeof nowISO === "function" ? nowISO() : String(nowISO);
  const approvalIds = [];
  let synced = 0;

  for (const draft of safeArray(pendingDecisionDrafts)) {
    if (!draft?.id) continue;
    const status = String(draft.status ?? "pending_approval").toLowerCase();
    if (status !== "pending_approval" && status !== "pending") continue;

    const approvalId = approvalIdForDecisionDraft(draft.id);
    if (approvalRuntime.getRequestById(approvalId)) {
      approvalIds.push(approvalId);
      continue;
    }

    const channel = String(draft.channel ?? "email").toLowerCase() === "sms" ? "sms" : "email";
    const subject = String(draft.subject ?? "").trim();
    const bodyPreview = String(draft.bodyPreview ?? draft.body ?? "").trim();

    try {
      approvalRuntime.applyEvent({
        id: `evt_approval_requested_${approvalId}_${at.replace(/[^0-9]/g, "").slice(0, 14)}`,
        timestampISO: at,
        type: APPROVAL_INTERNAL_EVENT_TYPES.APPROVAL_REQUESTED,
        payload: {
          request: createApprovalRequest({
            id: approvalId,
            requestType: channel === "sms" ? "decision_draft_sms" : "decision_draft_email",
            source: "pending_decision_draft",
            sourceReference: {
              draftId: String(draft.id),
              businessId: String(businessId ?? ""),
              jobId: draft.jobId ? String(draft.jobId) : undefined,
              contactId: draft.contactId ? String(draft.contactId) : undefined,
              cardId: draft.cardId ? String(draft.cardId) : undefined,
            },
            status: "PENDING",
            requestedAt: String(draft.createdAt ?? at),
            requestedBy: String(draft.source ?? actorId),
            requiredApprover: "role:owner",
            context: {
              relatedWorkId: null,
              channel,
              label: subject || "Follow-up draft",
              audience: String(draft.audience ?? ""),
              subject: subject || (channel === "sms" ? "SMS follow-up" : "Follow-up"),
              bodyPreview: bodyPreview.slice(0, 500),
              recipientEmail: draft.recipientEmail ? String(draft.recipientEmail) : null,
              triggeredBy: String(draft.source ?? "platform"),
              draftId: String(draft.id),
            },
            metadata: {
              pendingDecisionDraft: true,
              draftId: String(draft.id),
              channel,
              source: String(draft.source ?? ""),
              recipientEmail: draft.recipientEmail ? String(draft.recipientEmail) : null,
              jobId: draft.jobId ? String(draft.jobId) : null,
            },
          }),
        },
      });
      synced += 1;
      approvalIds.push(approvalId);
    } catch {
      /* duplicate or validation — skip */
    }
  }

  return deepFreeze({ synced, approvalIds });
}

/**
 * Mark a draft approved/rejected after owner decision.
 */
export async function markPendingDecisionDraftDecided({
  platformStore,
  installation,
  draftId,
  decision,
  actorId = "owner",
} = {}) {
  if (!platformStore?.upsertBusinessOSInstallation || !installation || !draftId) {
    return deepFreeze({ ok: false, reason: "missing_inputs" });
  }
  const businessId = String(installation.businessId ?? "");
  const fresh = await platformStore.getBusinessOSInstallation(businessId).catch(() => installation);
  const drafts = safeArray(fresh?.configuration?.pendingDecisionDrafts).map((d) => {
    if (String(d?.id) !== String(draftId)) return d;
    return {
      ...d,
      status: decision === "GRANT" || decision === "APPROVE" ? "approved" : "rejected",
      decidedAt: new Date().toISOString(),
      decidedBy: actorId,
    };
  });
  await platformStore.upsertBusinessOSInstallation({
    id: fresh.id ?? fresh.installationId ?? `install_${businessId}`,
    businessId,
    specificationRowId: fresh.specificationRowId ?? null,
    specificationId: fresh.specificationId ?? `spec_${businessId}`,
    specificationVersion: fresh.specificationVersion ?? 1,
    specificationContentHash: fresh.specificationContentHash ?? fresh.contentHash ?? "draft_decide",
    planId: fresh.planId ?? `plan_${businessId}`,
    status: fresh.status ?? "installed",
    plan: fresh.plan ?? {},
    actionCheckpoints: Array.isArray(fresh.actionCheckpoints) ? fresh.actionCheckpoints : [],
    configuration: {
      ...(fresh.configuration ?? {}),
      pendingDecisionDrafts: drafts.slice(-40),
    },
    history: Array.isArray(fresh.history) ? fresh.history.slice(-50) : [],
    installedAt: fresh.installedAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    updatedBy: actorId,
  });
  return deepFreeze({ ok: true, draftId: String(draftId) });
}
