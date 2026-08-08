/**
 * Shared owner prove flow helpers for Integrations / Launch.
 * Destination + confirm rules come from proveOwnerGuidance (single source of truth).
 */
import { proveGuidanceForAction } from "./proveOwnerGuidance.js";
import { buildProveOwnerVerification } from "./proveOwnerVerification.js";

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
 * Pass businessId so verification can deep-link Decisions honestly.
 */
export function buildProveOwnerResultCopy({
  action,
  result = {},
  ok = false,
  businessId = null,
  peopleVisible = false,
} = {}) {
  const verification = buildProveOwnerVerification({
    action,
    businessId,
    result,
    ok,
    peopleVisible,
  });
  return {
    title: verification.title,
    steps: verification.steps.map((s) => (typeof s === "string" ? s : s.text)),
    stepItems: verification.steps,
    evidence: verification.evidence,
    primaryCta: verification.primaryCta,
    banner: verification.banner,
  };
}
