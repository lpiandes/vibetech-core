import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";
import { readinessLabelFor } from "./resolveResponsibilityFeasibility.js";

/**
 * Responsibility-scoped Go Live projection — partial open is honest.
 * Business can operate when ≥1 responsibility is safe; blocked ones stay visible.
 *
 * Home UI gets short owner verbs — never dump engine constraint essays.
 */

const SHORT_ACTION_BY_TYPE = Object.freeze({
  ACCOUNT_CONNECTION_REQUIRED: "Connect an account",
  AUTHORIZED_DATA_SOURCE_REQUIRED: "Connect a data source",
  BUSINESS_RULE_REQUIRED: "Confirm how this should work",
  CONSENT_POLICY_REQUIRED: "Confirm who we may contact",
  UNSUPPORTED_TRIGGER: "Change how this is triggered",
});

const CHANNELS = Object.freeze({
  business_email: Object.freeze({
    aliases: ["business_email", "gmail", "email"],
    capabilityId: "customer_email_send",
    connectLabel: "Connect business email",
    proveLabel: "Prove business email",
  }),
  calendar: Object.freeze({
    aliases: ["calendar", "google_calendar"],
    capabilityId: "calendar_scheduling",
    connectLabel: "Connect calendar",
    proveLabel: "Prove calendar",
  }),
  sms_channel: Object.freeze({
    aliases: ["sms_channel", "twilio_sms", "sms"],
    capabilityId: "sms_send",
    connectLabel: "Connect SMS",
    proveLabel: "Prove SMS delivery",
  }),
  voice_channel: Object.freeze({
    aliases: ["voice_channel", "twilio_voice", "voice"],
    capabilityId: "voice_calls",
    connectLabel: "Connect business phone",
    proveLabel: "Prove missed-call handling",
  }),
  meta_lead_ads: Object.freeze({
    aliases: ["meta_lead_ads", "meta", "facebook_lead_ads"],
    capabilityId: "meta_lead_intake",
    connectLabel: "Connect Facebook Lead Ads",
    proveLabel: "Prove lead intake",
  }),
});

function channelForConstraint(constraint) {
  const text = [
    constraint?.description,
    constraint?.resolutionAction,
    constraint?.evidenceNeeded,
  ].map((value) => String(value ?? "")).join(" ").toLowerCase();
  if (/calendar|appointment event/.test(text)) return "calendar";
  if (/sms|text messag|twilio/.test(text)) return "sms_channel";
  if (/voice|phone|call route|missed.call/.test(text)) return "voice_channel";
  if (/meta|facebook|lead ads/.test(text)) return "meta_lead_ads";
  if (/email|gmail|outlook/.test(text)) return "business_email";
  return null;
}

function isConnected(connectionStatuses, channelId) {
  const channel = CHANNELS[channelId];
  if (!channel) return false;
  return channel.aliases.some((id) => {
    const status = String(connectionStatuses?.[id] ?? "").toUpperCase();
    return status === "CONNECTED" || status === "VERIFIED" || status === "PROVEN";
  });
}

function proofFor(proofRecords, capabilityId) {
  const row = proofRecords?.[capabilityId] ?? null;
  if (!row) return null;
  const proven = Boolean(row.ok || row.verified || String(row.status ?? "").toLowerCase() === "proven");
  return proven ? row : null;
}

function presentConstraint(constraint, { connectionStatuses, proofRecords }) {
  const sourceStatus = String(constraint?.status ?? "open");
  if (sourceStatus === "resolved" || sourceStatus === "accepted_fallback" || sourceStatus === "wont_fix") {
    return { ...constraint, sourceStatus, status: sourceStatus };
  }
  if (String(constraint?.type) !== "ACCOUNT_CONNECTION_REQUIRED") {
    return { ...constraint, sourceStatus, status: sourceStatus };
  }

  const channelId = channelForConstraint(constraint);
  const channel = channelId ? CHANNELS[channelId] : null;
  if (!channelId || !channel) return { ...constraint, sourceStatus, status: sourceStatus };

  const proof = proofFor(proofRecords, channel.capabilityId);
  if (proof) {
    return {
      ...constraint,
      sourceStatus,
      status: "resolved",
      resolvedAt: constraint?.resolvedAt ?? proof.at ?? proof.updatedAt ?? proof.createdAt ?? null,
      proofReference: constraint?.proofReference ?? channel.capabilityId,
      channelId,
      capabilityId: channel.capabilityId,
      effectiveAction: null,
    };
  }

  if (isConnected(connectionStatuses, channelId)) {
    return {
      ...constraint,
      sourceStatus,
      status: "in_progress",
      channelId,
      capabilityId: channel.capabilityId,
      effectiveAction: channel.proveLabel,
    };
  }

  return {
    ...constraint,
    sourceStatus,
    status: "open",
    channelId,
    capabilityId: channel.capabilityId,
    effectiveAction: channel.connectLabel,
  };
}

function shortActionForConstraint(constraint) {
  if (constraint?.effectiveAction) return String(constraint.effectiveAction);
  const type = String(constraint?.type ?? "");
  if (SHORT_ACTION_BY_TYPE[type]) return SHORT_ACTION_BY_TYPE[type];
  const resolution = String(constraint?.resolutionAction ?? "").toLowerCase();
  if (/email|gmail|outlook/.test(resolution)) return "Connect business email";
  if (/calendar/.test(resolution)) return "Connect calendar";
  if (/sms|twilio/.test(resolution)) return "Connect SMS";
  if (/phone|number|forward/.test(resolution)) return "Connect business phone";
  if (/clarif|question|rule/.test(resolution)) return "Answer a few questions";
  return "Finish this step";
}

function uniqueShortActions(constraints = []) {
  const seen = new Set();
  const out = [];
  for (const c of constraints) {
    if (!["open", "in_progress"].includes(String(c.status ?? "open"))) continue;
    if (String(c.owner) !== "Customer") continue;
    const label = shortActionForConstraint(c);
    if (seen.has(label)) continue;
    seen.add(label);
    out.push(label);
    if (out.length >= 2) break;
  }
  return out;
}

export function presentResponsibilityGoLive({
  responsibilityRequests = [],
  connectionStatuses = {},
  proofRecords = {},
} = {}) {
  const items = (Array.isArray(responsibilityRequests) ? responsibilityRequests : [])
    .filter((r) => r && String(r.status) !== "removed")
    .map((request) => {
      const constraints = (Array.isArray(request.constraints) ? request.constraints : [])
        .map((constraint) => presentConstraint(constraint, { connectionStatuses, proofRecords }));
      const openCustomer = constraints.filter(
        (c) => ["open", "in_progress"].includes(String(c.status ?? "open")) && String(c.owner) === "Customer",
      );
      const openVibetech = constraints.filter(
        (c) => ["open", "in_progress"].includes(String(c.status ?? "open")) && String(c.owner) === "VIBETech",
      );
      const mode = String(request.implementationMode ?? "");
      let bucket = "needs_clarification";
      if (mode === "unsupported_or_unsafe") bucket = "cannot_install";
      else if (openCustomer.length) bucket = "needs_your_action";
      else if (openVibetech.length || mode === "operator_assisted" || mode === "requires_reusable_capability") {
        bucket = "vibetech_working";
      } else if (String(request.status) === "live") {
        bucket = "live";
      } else if (["ready_existing_capabilities", "ready_after_customer_access", "ready_after_business_rules"].includes(mode)) {
        bucket = "ready_for_shadow";
      }

      const emailOk = String(connectionStatuses.business_email ?? "").toUpperCase() === "CONNECTED";
      const calendarOk = String(connectionStatuses.calendar ?? "").toUpperCase() === "CONNECTED";
      const shortActions = uniqueShortActions(openCustomer);
      const primaryConstraint = openCustomer[0] ?? null;
      const primaryAction = shortActions[0]
        ?? (bucket === "needs_your_action" ? "Continue setup" : null);

      return deepFreeze({
        responsibilityId: request.responsibilityId,
        title: request.title,
        mode,
        readinessLabel: readinessLabelFor(mode),
        bucket,
        outcome: request.requestedOutcome || request.rawRequest,
        shortActions,
        primaryAction,
        primaryConstraintType: primaryConstraint?.type ?? null,
        primaryConnectionId: primaryConstraint?.channelId ?? null,
        primaryCapabilityId: primaryConstraint?.capabilityId ?? null,
        constraints: constraints.map((c) => ({
          constraintId: c.constraintId,
          type: c.type,
          description: c.description,
          owner: c.owner,
          resolutionAction: c.resolutionAction,
          shortAction: shortActionForConstraint(c),
          status: c.status ?? "open",
          sourceStatus: c.sourceStatus ?? c.status ?? "open",
          channelId: c.channelId ?? null,
          capabilityId: c.capabilityId ?? null,
          proofReference: c.proofReference ?? null,
          fallback: c.fallback ?? null,
        })),
        checklistHints: {
          businessEmailConnected: emailOk,
          calendarConnected: calendarOk,
        },
      });
    });

  // Collapse duplicate titles from messy Builder extracts (same outcome twice).
  const seenTitles = new Set();
  const deduped = [];
  for (const item of items) {
    const key = String(item.title ?? "").trim().toLowerCase();
    if (key && seenTitles.has(key)) continue;
    if (key) seenTitles.add(key);
    deduped.push(item);
  }
  const readyCount = deduped.filter((i) => ["ready_for_shadow", "live"].includes(i.bucket)).length;
  const actionable = deduped.filter((i) => i.bucket === "needs_your_action");
  const vibetechWorking = deduped.filter((i) => i.bucket === "vibetech_working");
  const blocked = deduped.filter((i) => i.bucket === "cannot_install");

  return deepFreeze({
    total: deduped.length,
    readyCount,
    canOpenBusiness: readyCount >= 1 || vibetechWorking.length >= 1,
    summary: deduped.length
      ? `${readyCount} of ${deduped.length} ready`
      : "No responsibilities yet",
    needsYourAction: actionable,
    vibetechWorking,
    readyForShadow: deduped.filter((i) => i.bucket === "ready_for_shadow"),
    live: deduped.filter((i) => i.bucket === "live"),
    cannotInstall: blocked,
    items: deduped,
  });
}
