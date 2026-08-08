/**
 * Shared SMS carrier (A2P / 10DLC) status helpers.
 * Connected credentials ≠ US delivery until carrier approval.
 */
import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";

/** @typedef {"approved" | "pending" | "failed" | "unknown"} SmsCarrierPhase */

/**
 * Normalize any a2p / Trust Hub status string from metadata or APIs.
 * @param {unknown} raw
 * @returns {SmsCarrierPhase}
 */
export function normalizeSmsCarrierPhase(raw) {
  const s = String(raw ?? "").trim().toLowerCase();
  if (!s) return "unknown";
  if (s === "approved" || s === "complete" || s === "completed" || s === "ready") return "approved";
  if (s === "failed" || s === "rejected" || s === "denied") return "failed";
  if (
    s === "pending"
    || s === "in_review"
    || s === "in-progress"
    || s === "submitted"
    || s === "processing"
  ) {
    return "pending";
  }
  return "pending";
}

/**
 * Read carrier status from a connection row, runtime conn, or plain metadata bag.
 * @param {unknown} source
 * @returns {SmsCarrierPhase}
 */
export function resolveSmsCarrierPhaseFromConnection(source) {
  if (source == null) return "unknown";
  if (typeof source === "string") {
    // Bare CONNECTED status string has no A2P evidence — unknown, not approved.
    const upper = source.toUpperCase();
    if (upper === "CONNECTED" || upper === "VERIFIED" || upper === "PROVEN" || upper === "OK") {
      return "unknown";
    }
    return normalizeSmsCarrierPhase(source);
  }
  const obj = typeof source === "object" ? source : {};
  const meta = (obj.metadata && typeof obj.metadata === "object")
    ? obj.metadata
    : obj;
  const raw = meta?.a2pRegistrationStatus
    ?? meta?.a2pStatus
    ?? obj.a2pRegistrationStatus
    ?? obj.a2pStatus
    ?? null;
  return normalizeSmsCarrierPhase(raw);
}

/**
 * Owner-facing copy when SMS is Connected (credentials saved).
 * @param {unknown} source
 * @returns {string}
 */
export function smsCarrierOwnerCopy(source) {
  const phase = resolveSmsCarrierPhaseFromConnection(source);
  if (phase === "approved") {
    return "Connected — carrier approved. Run Test it works with a real text.";
  }
  if (phase === "failed") {
    return "Connected — carrier approval failed. VIBETech will fix Trust Hub / A2P with you.";
  }
  return "Connected — carrier approval pending (US texts may not deliver until approved). Use Refresh status to check Twilio, then Test it works when ready.";
}

/**
 * Package Connect step for SMS is complete only when Connected + carrier approved.
 * @param {unknown} source connection status string or { status, a2pRegistrationStatus }
 */
export function smsConnectStepComplete(source) {
  if (source == null) return false;
  const status = typeof source === "object"
    ? String(source.status ?? source.state ?? "")
    : String(source);
  const upper = status.toUpperCase();
  if (!(upper === "CONNECTED" || upper === "VERIFIED" || upper === "PROVEN" || upper === "OK" || source === true)) {
    return false;
  }
  return resolveSmsCarrierPhaseFromConnection(source) === "approved";
}

/**
 * @param {unknown} source
 * @returns {{ phase: SmsCarrierPhase, copy: string, deliveryLikely: boolean }}
 */
export function describeSmsCarrierStatus(source) {
  const phase = resolveSmsCarrierPhaseFromConnection(source);
  return deepFreeze({
    phase,
    copy: smsCarrierOwnerCopy(source),
    deliveryLikely: phase === "approved",
  });
}
