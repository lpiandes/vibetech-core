/**
 * Shared owner prove flow helpers for Integrations / Launch.
 * Voice/SMS/email need a destination + optional owner confirm.
 */

/** Actions that must collect a destination before proving. */
export function proveNeedsDestination(action) {
  const a = String(action ?? "");
  if (a === "place_test_call" || a === "place_test_outbound_call") return "phone";
  if (a === "send_test_sms") return "phone";
  if (a === "send_test_email") return "email";
  return null;
}

/** Actions that ask the owner to confirm receipt after dial/send. */
export function proveNeedsOwnerConfirm(action) {
  const a = String(action ?? "");
  return (
    a === "send_test_email"
    || a === "send_test_sms"
    || a === "create_test_event"
    || a === "place_test_call"
    || a === "place_test_outbound_call"
  );
}

export function buildProveRequestBody({
  action,
  capabilityId,
  provePhone = null,
  proveEmail = null,
  ownerConfirmedReceipt = false,
  outboundApproved = true,
} = {}) {
  return {
    action: String(action ?? ""),
    capabilityId: String(capabilityId ?? ""),
    outboundApproved: outboundApproved !== false,
    ...(provePhone ? { provePhone: String(provePhone).trim() } : {}),
    ...(proveEmail ? { proveEmail: String(proveEmail).trim() } : {}),
    ...(ownerConfirmedReceipt ? { ownerConfirmedReceipt: true } : {}),
  };
}

export function isProveAwaitingConfirm(result = {}) {
  return String(result?.status ?? "") === "awaiting_confirm"
    || result?.awaitingOwnerConfirm === true
    || result?.detail?.awaitingOwnerConfirm === true;
}
