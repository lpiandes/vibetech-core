import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";
import { sendSpecialtyOutbound, sendSpecialtyPathOutbound } from "./specialtyOutbound.js";
import { progressRftOpportunity } from "../operating-contract/rft/rftOpportunityRuntime.js";
import { findCardByEvidenceProviderId } from "../operating-contract/rft/rftInboundIngest.js";

/**
 * After owner GRANT on a specialty_automation approval, actually send outbound
 * and advance any linked RFT opportunity. Plan 19 — Approve and send must execute.
 *
 * Returns { ok, send, rft } — never fabricates success.
 */

function recipientsFromWorkItem(workItem) {
  const meta = workItem?.metadata && typeof workItem.metadata === "object" ? workItem.metadata : {};
  const payload = meta.eventPayload && typeof meta.eventPayload === "object" ? meta.eventPayload : {};
  const contact = meta.contact && typeof meta.contact === "object" ? meta.contact : {};
  const email = String(
    payload.email
    ?? payload.fromEmail
    ?? payload.replyTo
    ?? contact.email
    ?? meta.recipientEmail
    ?? "",
  ).trim();
  const phone = String(
    payload.phone
    ?? payload.fromPhone
    ?? contact.phone
    ?? meta.recipientPhone
    ?? "",
  ).trim();
  const name = String(payload.name ?? payload.fromName ?? contact.name ?? "").trim() || null;
  const list = [];
  if (email) list.push({ address: email, email, name });
  if (phone) list.push({ phone, name });
  return list;
}

function rftCardIdFromWorkItem(workItem, installation) {
  const meta = workItem?.metadata && typeof workItem.metadata === "object" ? workItem.metadata : {};
  const direct = String(meta.rftCardId ?? meta.cardId ?? meta.opportunityCardId ?? "").trim();
  if (direct) return direct;
  const providerId = String(
    meta.eventPayload?.messageId
    ?? meta.eventPayload?.providerId
    ?? meta.providerId
    ?? "",
  ).trim();
  if (providerId && installation) {
    return findCardByEvidenceProviderId(installation, providerId)?.id ?? null;
  }
  return null;
}

function proofEvidenceFromSend(sendResult) {
  const evidence = [];
  const rows = Array.isArray(sendResult?.results) ? sendResult.results : [];
  for (const row of rows) {
    const providerId = String(
      row?.detail?.providerId
      ?? row?.detail?.messageId
      ?? row?.detail?.id
      ?? row?.providerId
      ?? "",
    ).trim();
    if (!providerId && !row?.ok) continue;
    evidence.push({
      kind: row.channel === "sms" ? "sms_send" : "email_send",
      providerId: providerId || `local_${row.channel}_${Date.now()}`,
      at: new Date().toISOString(),
      detail: row.ok ? "delivered" : String(row.reason ?? "failed"),
    });
  }
  if (!evidence.length && sendResult?.ok) {
    evidence.push({
      kind: "outbound_send",
      providerId: `send_${Date.now()}`,
      at: new Date().toISOString(),
      detail: "specialty_path_send",
    });
  }
  return evidence;
}

/**
 * @returns {Promise<{ ok: boolean, skipped?: boolean, reason?: string, send?: object, rft?: object, message?: string }>}
 */
export async function fulfillSpecialtyApprovalGrant({
  approvalRequest,
  businessId,
  platformStore,
  installation,
  workRuntime,
  integrationHub = null,
  actorId = "owner",
} = {}) {
  const source = String(approvalRequest?.source ?? "");
  const ref = approvalRequest?.sourceReference && typeof approvalRequest.sourceReference === "object"
    ? approvalRequest.sourceReference
    : {};
  const isSpecialty = source === "specialty_automation"
    || Boolean(approvalRequest?.metadata?.specialtyPath)
    || Boolean(ref.workItemId && ref.employeeId);

  if (!isSpecialty) {
    return deepFreeze({ ok: true, skipped: true, reason: "not_specialty_approval" });
  }

  const workItemId = String(ref.workItemId ?? approvalRequest?.context?.workItemId ?? "").trim();
  const employeeId = String(ref.employeeId ?? "").trim();
  const bid = String(businessId ?? ref.businessId ?? "").trim();
  if (!workItemId || !bid) {
    return deepFreeze({
      ok: false,
      reason: "missing_work_or_business",
      message: "Approval is missing workItemId/businessId — cannot send.",
    });
  }

  const workItem = workRuntime?.getWorkItem?.(workItemId)
    ?? (approvalRequest?.metadata?.synthesizeWork
      ? {
        id: workItemId,
        title: String(approvalRequest?.context?.subject ?? approvalRequest?.context?.label ?? "Outbound"),
        metadata: {
          ...(approvalRequest.metadata ?? {}),
          eventPayload: approvalRequest.metadata?.eventPayload
            ?? {
              email: approvalRequest.context?.recipientEmail ?? null,
              name: approvalRequest.context?.partyName ?? null,
              phone: approvalRequest.context?.recipientPhone ?? null,
            },
          rftCardId: approvalRequest.metadata?.rftCardId ?? null,
          contact: {
            email: approvalRequest.context?.recipientEmail ?? null,
            name: approvalRequest.context?.partyName ?? null,
          },
        },
      }
      : null);
  if (!workItem) {
    return deepFreeze({
      ok: false,
      reason: "work_not_found",
      message: `Work ${workItemId} not found — cannot send.`,
    });
  }

  const employees = Array.isArray(installation?.configuration?.employees)
    ? installation.configuration.employees
    : [];
  const employee = employees.find(
    (e) => String(e?.employeeId ?? e?.id ?? "") === employeeId,
  ) ?? (employeeId ? { employeeId } : employees.find((e) => e?.operatingContract?.rft) ?? employees[0] ?? null);

  const recipients = recipientsFromWorkItem(workItem);
  const recipientsByAudience = {
    scope_who: recipients,
    submitter: recipients,
    team: recipients,
  };

  let send = null;
  if (employee?.operatingContract?.automationPath?.steps?.length) {
    send = await sendSpecialtyPathOutbound({
      businessId: bid,
      employee,
      workItem,
      recipientsByAudience,
      outboundApproved: true,
      integrationHub,
    });
  } else {
    const channel = String(approvalRequest?.context?.channel ?? approvalRequest?.metadata?.channel ?? "email");
    send = await sendSpecialtyOutbound({
      businessId: bid,
      workItem,
      channels: [channel === "sms" ? "sms" : "email"],
      recipients,
      emailSubject: String(approvalRequest?.context?.subject ?? workItem?.title ?? ""),
      emailBody: String(approvalRequest?.context?.bodyPreview ?? approvalRequest?.metadata?.bodyTemplate ?? ""),
      smsBody: String(approvalRequest?.context?.bodyPreview ?? ""),
      outboundApproved: true,
      integrationHub,
    });
  }

  if (!send?.ok) {
    const cardId = rftCardIdFromWorkItem(workItem, installation);
    let rft = null;
    if (cardId && platformStore && installation) {
      rft = await progressRftOpportunity({
        platformStore,
        installation,
        cardId,
        toState: "Exception",
        eventType: "EXCEPTION_RAISED",
        actorId,
        note: `Outbound failed after GRANT: ${send?.reason ?? send?.note ?? "send_failed"}`,
        outcomeType: "HumanInterventionRequired",
      }).catch(() => null);
    }
    return deepFreeze({
      ok: false,
      reason: send?.reason ?? "send_failed",
      message: send?.note ?? "Outbound send failed after approval.",
      send,
      rft,
    });
  }

  const evidence = proofEvidenceFromSend(send);
  const cardId = rftCardIdFromWorkItem(workItem, installation);
  let rft = null;
  if (cardId && platformStore && installation) {
    await progressRftOpportunity({
      platformStore,
      installation,
      cardId,
      eventType: "APPROVAL_GRANTED",
      actorId,
      note: "Owner approved and send started",
    }).catch(() => null);
    const fresh = await platformStore.getBusinessOSInstallation(bid).catch(() => installation);
    rft = await progressRftOpportunity({
      platformStore,
      installation: fresh ?? installation,
      cardId,
      toState: "Verified",
      evidence,
      actorId,
      note: "Outbound delivered after owner GRANT",
      outcomeType: "FollowUpCompleted",
    }).catch(() => null);
  }

  return deepFreeze({
    ok: true,
    send,
    rft,
    cardId,
    evidence,
  });
}
