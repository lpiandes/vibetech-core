/**
 * Fulfill owner GRANT on pending_decision_draft approvals (forms / Meta / marketing).
 * Prove placeholder recipients are closed without a fake live send.
 */
import { deepFreeze } from "../workspace/_utils/deepFreeze.js";
import { isReplaceableDecisionDraftSource } from "./collapsePendingDecisionDrafts.js";
import { markPendingDecisionDraftDecided } from "./syncPendingDecisionDraftsToApprovals.js";

function isPlaceholderRecipient(email) {
  const e = String(email ?? "").trim().toLowerCase();
  if (!e) return true;
  return (
    e.endsWith("@example.com")
    || e.endsWith(".example")
    || e.startsWith("prove-")
    || e.includes("+prove@")
  );
}

/**
 * @returns {Promise<{ ok: boolean, skipped?: boolean, simulated?: boolean, sent?: boolean, reason?: string, message?: string, detail?: object }>}
 */
export async function fulfillPendingDecisionDraftGrant({
  approvalRequest,
  businessId,
  platformStore,
  installation,
  integrationHub = null,
  actorId = "owner",
} = {}) {
  const source = String(approvalRequest?.source ?? "");
  if (source !== "pending_decision_draft") {
    return deepFreeze({ ok: true, skipped: true, reason: "not_decision_draft" });
  }

  const draftId = String(
    approvalRequest?.sourceReference?.draftId
    ?? approvalRequest?.context?.draftId
    ?? approvalRequest?.metadata?.draftId
    ?? "",
  ).trim();
  const draftSource = String(approvalRequest?.metadata?.source ?? approvalRequest?.requestedBy ?? "");
  const recipientEmail = String(
    approvalRequest?.context?.recipientEmail
    ?? approvalRequest?.metadata?.recipientEmail
    ?? "",
  ).trim();
  const subject = String(approvalRequest?.context?.subject ?? approvalRequest?.context?.label ?? "Follow-up").trim();
  const body = String(approvalRequest?.context?.bodyPreview ?? "").trim();
  const channel = String(approvalRequest?.context?.channel ?? approvalRequest?.metadata?.channel ?? "email").toLowerCase();

  // Controlled prove drafts — approve closes the card; do not invent a customer send.
  if (isReplaceableDecisionDraftSource(draftSource) || isPlaceholderRecipient(recipientEmail)) {
    if (installation && draftId && platformStore) {
      await markPendingDecisionDraftDecided({
        platformStore,
        installation,
        draftId,
        decision: "GRANT",
        actorId,
      }).catch(() => null);
    }
    return deepFreeze({
      ok: true,
      simulated: true,
      sent: false,
      reason: "prove_or_placeholder",
      message: "Approved. This was a test follow-up — no live email was sent to a placeholder address.",
      detail: { draftId, recipientEmail: recipientEmail || null },
    });
  }

  if (channel !== "sms" && !recipientEmail) {
    return deepFreeze({
      ok: false,
      reason: "missing_recipient",
      message: "This draft has no recipient email — edit the contact, then approve again.",
    });
  }

  if (!integrationHub?.executeAction) {
    // Still mark decided so the queue clears; owner can follow up manually.
    if (installation && draftId && platformStore) {
      await markPendingDecisionDraftDecided({
        platformStore,
        installation,
        draftId,
        decision: "GRANT",
        actorId,
      }).catch(() => null);
    }
    return deepFreeze({
      ok: true,
      sent: false,
      reason: "no_integration_hub",
      message: "Approved and closed. Connect business email to send live follow-ups automatically.",
    });
  }

  const sent = await integrationHub.executeAction({
    connectionType: "business_email",
    capability: "SEND_EMAIL",
    input: {
      to: recipientEmail,
      subject,
      body,
      outboundApproved: true,
    },
  }).catch((err) => ({
    ok: false,
    reason: "send_error",
    message: err instanceof Error ? err.message : String(err),
  }));

  if (!sent?.ok) {
    return deepFreeze({
      ok: false,
      reason: sent?.reason ?? "send_failed",
      message: String(sent?.message ?? sent?.error ?? "Could not send the approved email. Check business email connection."),
      detail: sent,
    });
  }

  if (installation && draftId && platformStore) {
    await markPendingDecisionDraftDecided({
      platformStore,
      installation,
      draftId,
      decision: "GRANT",
      actorId,
    }).catch(() => null);
  }

  return deepFreeze({
    ok: true,
    sent: true,
    message: `Sent to ${recipientEmail}.`,
    detail: { draftId, recipientEmail, provider: sent },
  });
}
