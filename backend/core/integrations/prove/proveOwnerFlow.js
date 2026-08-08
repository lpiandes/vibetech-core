/**
 * Shared owner prove flow helpers for Integrations / Launch.
 * Destination + confirm rules come from proveOwnerGuidance (single source of truth).
 */
import { proveGuidanceForAction } from "./proveOwnerGuidance.js";

/** Actions that must collect a destination before proving. */
export function proveNeedsDestination(action) {
  const kind = proveGuidanceForAction(action).destinationKind;
  return kind === "phone" || kind === "email" ? kind : null;
}

/** Actions that ask the owner to confirm receipt after dial/send. */
export function proveNeedsOwnerConfirm(action) {
  return proveGuidanceForAction(action).needsConfirm === true;
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

/**
 * Build owner-facing result copy after a prove attempt (modal + banner).
 */
export function buildProveOwnerResultCopy({ action, result = {}, ok = false } = {}) {
  const guidance = proveGuidanceForAction(action);
  if (ok) {
    return {
      title: guidance.successTitle,
      steps: [...guidance.successSteps],
      banner: [guidance.successTitle, ...(guidance.successSteps ?? [])].filter(Boolean).join(" — "),
    };
  }
  const message = String(result?.message ?? "Prove failed.");
  return {
    title: "Test didn’t finish",
    steps: [message, "Fix the issue, then tap Test it works again."],
    banner: message,
  };
}
