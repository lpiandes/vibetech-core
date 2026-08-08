/**
 * Resolve white-glove Request setup: required owner actions, validation, ops notify policy.
 * Auto-fulfill hooks live here so UI/API stay free of per-connection branching.
 */
import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";
import { getWhiteGloveConnection } from "../whiteglove/WhiteGloveConnectionRegistry.js";
import {
  buildOwnerInputsPayload,
  ownerActionStepsForFields,
  resolveOwnerInputFields,
  validateOwnerInputs,
} from "./ownerInputFieldCatalog.js";

/**
 * @typedef {"always" | "only_if_ops_needed" | "never"} OpsNotifyPolicy
 */

/**
 * Optional auto-fulfillers keyed by connectionId.
 * Return { ok, opsStillNeeded, message?, detail? }.
 * When ok && !opsStillNeeded → no ops email.
 */
const AUTO_FULFILLERS = {
  // Future: sms_channel → provision with platform Twilio when brand fields complete
};

export function collectFieldIdsForConnection(connectionId) {
  const wg = getWhiteGloveConnection(connectionId);
  return deepFreeze([...(wg?.collectFromOwner ?? [])]);
}

export function resolveOwnerSetupForm(connectionId) {
  const wg = getWhiteGloveConnection(connectionId);
  const fieldIds = collectFieldIdsForConnection(connectionId);
  const fields = resolveOwnerInputFields(fieldIds);
  const actionSteps = ownerActionStepsForFields(fieldIds);
  return deepFreeze({
    connectionId: wg?.connectionId ?? connectionId,
    ownerTitle: wg?.ownerTitle ?? String(connectionId ?? ""),
    intro: wg?.ownerRequestIntro
      ?? (actionSteps.length
        ? "To set this up for you, we need a few things from you first. Follow the short steps under each field."
        : "Request setup and we’ll finish the wiring — you don’t need console passwords."),
    fields,
    actionSteps,
    opsNotifyPolicy: wg?.opsNotifyPolicy ?? "always",
  });
}

/**
 * Decide whether platform ops still needs an email after owner submit / auto attempt.
 */
export function resolveOpsNotifyDecision({
  connectionId,
  ownerInputs = {},
  autoResult = null,
} = {}) {
  const wg = getWhiteGloveConnection(connectionId);
  const policy = wg?.opsNotifyPolicy ?? "always";

  if (policy === "never") {
    return deepFreeze({ notify: false, reason: "policy_never" });
  }

  if (policy === "only_if_ops_needed") {
    if (autoResult?.ok && autoResult?.opsStillNeeded === false) {
      return deepFreeze({ notify: false, reason: "auto_handled" });
    }
    return deepFreeze({
      notify: true,
      reason: autoResult?.ok === false ? "auto_failed" : "ops_still_needed",
    });
  }

  // always — still skip email if auto fully handled
  if (autoResult?.ok && autoResult?.opsStillNeeded === false) {
    return deepFreeze({ notify: false, reason: "auto_handled" });
  }
  return deepFreeze({ notify: true, reason: "ops_required" });
}

/**
 * Try connection-specific auto fulfill (no hardcoding in callers).
 */
export async function tryAutoFulfillOwnerSetup({
  connectionId,
  ownerInputs = {},
  context = {},
} = {}) {
  const id = String(connectionId ?? "");
  const fn = AUTO_FULFILLERS[id];
  if (typeof fn !== "function") {
    return deepFreeze({ ok: false, opsStillNeeded: true, reason: "no_auto_fulfiller" });
  }
  try {
    const result = await fn({ connectionId: id, ownerInputs, context });
    return deepFreeze({
      ok: result?.ok === true,
      opsStillNeeded: result?.opsStillNeeded !== false,
      reason: result?.reason ?? null,
      message: result?.message ?? null,
      detail: result?.detail ?? null,
    });
  } catch (err) {
    return deepFreeze({
      ok: false,
      opsStillNeeded: true,
      reason: "auto_error",
      message: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Full pre-submit resolution for Request setup.
 */
export function resolveOwnerSetupRequest({ connectionId, values = {} } = {}) {
  const form = resolveOwnerSetupForm(connectionId);
  const validation = validateOwnerInputs(
    form.fields.map((f) => f.id),
    values,
  );
  const ownerInputs = buildOwnerInputsPayload(
    form.fields.map((f) => f.id),
    values,
  );
  return deepFreeze({
    form,
    validation,
    ownerInputs,
    canSubmit: validation.ok,
  });
}

/** Test helper / registry extension point. Pass null to unregister. */
export function registerOwnerSetupAutoFulfiller(connectionId, fn) {
  if (!connectionId) return false;
  const id = String(connectionId);
  if (fn == null) {
    delete AUTO_FULFILLERS[id];
    return true;
  }
  if (typeof fn !== "function") return false;
  AUTO_FULFILLERS[id] = fn;
  return true;
}
