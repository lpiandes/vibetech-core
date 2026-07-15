import { deepFreeze } from "../workspace/_utils/deepFreeze.js";
import { INTEGRATION_CAPABILITIES } from "../integrations/capabilities/IntegrationCapability.js";
import { MEMBERSHIP_ROLES, PERMISSIONS, hasPermission } from "../platform/permissions/rolePermissions.js";

/**
 * Platform law: anything sent to an external person needs human approval first.
 * Internal work / drafts / CREATE_WORK stay autonomous.
 */

export const OUTBOUND_CAPABILITIES = Object.freeze([
  INTEGRATION_CAPABILITIES.SEND_EMAIL,
  INTEGRATION_CAPABILITIES.SEND_SMS,
  INTEGRATION_CAPABILITIES.PLACE_VOICE_CALL,
]);

export const OUTBOUND_CHANNELS = Object.freeze(["email", "sms", "voice", "phone"]);

export function isOutboundCapability(capability) {
  return OUTBOUND_CAPABILITIES.includes(String(capability ?? ""));
}

export function isOutboundChannel(channel) {
  return OUTBOUND_CHANNELS.includes(String(channel ?? "").toLowerCase());
}

export function isOutboundAutomationAction(action = {}) {
  const type = String(action.actionType ?? "");
  if (type === "EXECUTE_EXTERNAL_ACTION") {
    return isOutboundCapability(action.parameters?.capability);
  }
  if (type === "SEND_EMAIL" || type === "SEND_SMS") return true;
  return false;
}

/**
 * Whether this external action may call the provider now.
 * Outbound customer-facing actions require outboundApproved (set only after human GRANT).
 */
export function evaluateOutboundSendPermission({
  capability = null,
  channel = null,
  direction = null,
  requiresApproval = false,
  outboundApproved = false,
  messageStatus = null,
} = {}) {
  const outbound = isOutboundCapability(capability)
    || isOutboundChannel(channel)
    || (String(direction).toLowerCase() === "outbound" && isOutboundChannel(channel));

  if (!outbound) {
    return deepFreeze({
      outbound: false,
      allowed: !requiresApproval || Boolean(outboundApproved),
      forceApproval: false,
      reason: null,
    });
  }

  if (Boolean(outboundApproved)) {
    return deepFreeze({
      outbound: true,
      allowed: true,
      forceApproval: false,
      reason: null,
    });
  }

  const status = String(messageStatus ?? "").toLowerCase();
  if (status === "draft") {
    return deepFreeze({
      outbound: true,
      allowed: false,
      forceApproval: true,
      reason: "outbound_approval_required",
    });
  }

  return deepFreeze({
    outbound: true,
    allowed: false,
    forceApproval: true,
    reason: "outbound_approval_required",
  });
}

export function canDecideOutboundApproval(role) {
  const r = String(role ?? "");
  if (r === MEMBERSHIP_ROLES.OWNER || r === MEMBERSHIP_ROLES.ADMIN || r === MEMBERSHIP_ROLES.MANAGER) {
    return true;
  }
  return hasPermission(r, PERMISSIONS.APPROVALS_DECIDE)
    || hasPermission(r, PERMISSIONS.WORK_MANAGE)
    || hasPermission(r, PERMISSIONS.INBOX_MANAGE);
}
