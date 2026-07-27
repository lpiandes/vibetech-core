/**
 * Per-node setup readiness for automation PATH (START + steps).
 * Manual runMode is NOT a setup blocker — only missing channels/CRM/providers.
 */
import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";
import { PATH_STEP_TYPES } from "./automationPath.js";

function asArray(value) {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (value == null || value === "") return [];
  return [String(value)].filter(Boolean);
}

function connectionTypes(snapshot = {}) {
  const list = Array.isArray(snapshot.connections) ? snapshot.connections : [];
  const set = new Set();
  for (const conn of list) {
    const type = String(conn?.connectionType ?? conn?.type ?? conn?.id ?? "").toLowerCase();
    if (type) set.add(type);
  }
  for (const id of asArray(snapshot.connectedTypes)) {
    set.add(String(id).toLowerCase());
  }
  return set;
}

function hasAny(types, candidates) {
  return candidates.some((id) => types.has(String(id).toLowerCase()));
}

function integrationsHref(businessId, focus = null) {
  const base = businessId
    ? `/b/${encodeURIComponent(businessId)}/integrations`
    : "/integrations";
  return focus ? `${base}?focus=${encodeURIComponent(focus)}` : base;
}

function blocker(code, label, href = null) {
  return deepFreeze({ code, label, href: href || null });
}

/**
 * Map specialty trigger event → required connection / setup.
 */
export function blockersForTriggerEvent(eventType, snapshot = {}) {
  const types = connectionTypes(snapshot);
  const businessId = snapshot.businessId ?? null;
  const originOk = snapshot.publicOriginOk !== false
    && Boolean(String(snapshot.appOrigin ?? "").trim())
    && !/localhost|127\.0\.0\.1/i.test(String(snapshot.appOrigin ?? ""));
  const event = String(eventType ?? "").trim().toUpperCase();
  const out = [];

  switch (event) {
    case "INBOUND_VOICE_CALL":
      if (!hasAny(types, ["voice_channel", "twilio_voice"])) {
        out.push(blocker(
          "voice_not_connected",
          "Connect Phone (Twilio Voice)",
          integrationsHref(businessId, "voice_channel"),
        ));
      } else if (!originOk) {
        out.push(blocker(
          "voice_webhook_origin",
          "Set a public APP_ORIGIN and point the Twilio Voice webhook to this business",
          integrationsHref(businessId, "voice_channel"),
        ));
      }
      break;
    case "META_LEAD":
      if (!hasAny(types, ["meta_lead_ads", "meta"])) {
        out.push(blocker(
          "meta_not_connected",
          "Connect Meta Lead Ads",
          integrationsHref(businessId, "meta_lead_ads"),
        ));
      }
      break;
    case "FORM_SUBMIT":
      // Hosted forms work without an external connection.
      break;
    case "NEW_INQUIRY":
    case "SPECIALTY_JOB_REQUESTED":
    case "SPECIALTY_SCHEDULE_DUE":
    case "PIPELINE_STAGE_ENTERED":
    case "SCHEDULE_CHANGE":
    case "EVENT_UPDATE":
    case "EVENT_REMINDER_DUE":
      break;
    case "SOCIAL_SCREEN_REQUESTED":
      if (!snapshot.socialScreeningReady) {
        out.push(blocker(
          "social_screening_keys",
          "Connect Social screening (Serper + ScrapingBee) or set platform keys",
          integrationsHref(businessId, "social_screening"),
        ));
      }
      break;
    default:
      break;
  }
  return out;
}

/**
 * START node readiness from trigger mode + event types.
 */
export function computeTriggerReadiness(trigger = {}, snapshot = {}) {
  const mode = String(trigger?.mode ?? "manual_or_events");
  const eventTypes = asArray(trigger?.eventTypes);
  const blockers = [];

  if (mode === "manual" || eventTypes.length === 0) {
    // Manual Run now always works for setup.
    return deepFreeze({ ready: true, blockers: [] });
  }

  for (const eventType of eventTypes) {
    // SPECIALTY_JOB_REQUESTED alone never blocks START.
    if (String(eventType).toUpperCase() === "SPECIALTY_JOB_REQUESTED") continue;
    blockers.push(...blockersForTriggerEvent(eventType, snapshot));
  }

  // Dedupe by code
  const seen = new Set();
  const unique = [];
  for (const row of blockers) {
    if (seen.has(row.code)) continue;
    seen.add(row.code);
    unique.push(row);
  }

  return deepFreeze({
    ready: unique.length === 0,
    blockers: unique,
  });
}

/**
 * Per action-step readiness.
 */
export function computeStepReadiness(step = {}, snapshot = {}) {
  if (step?.enabled === false) {
    return deepFreeze({ ready: true, blockers: [] });
  }

  const types = connectionTypes(snapshot);
  const businessId = snapshot.businessId ?? null;
  const type = String(step.type ?? "");
  const channels = asArray(step.channels).map((c) => c.toLowerCase());
  const blockers = [];

  const needsEmail = type === PATH_STEP_TYPES.SEND_EMAIL
    || type === PATH_STEP_TYPES.NOTIFY_TEAM
    || channels.includes("email")
    || String(step.channel ?? "").includes("email");
  const needsSms = type === PATH_STEP_TYPES.SEND_SMS
    || channels.includes("sms")
    || String(step.channel ?? "").includes("sms");

  if (type === PATH_STEP_TYPES.ADD_TO_PIPELINE) {
    if (snapshot.crmAvailable === false) {
      blockers.push(blocker(
        "crm_unavailable",
        "People / pipeline store is not available yet",
        businessId ? `/b/${encodeURIComponent(businessId)}/people` : null,
      ));
    }
  } else if (type === PATH_STEP_TYPES.CREATE_DRAFT) {
    // Always ready — platform Work.
  } else if (type === PATH_STEP_TYPES.SOCIAL_SCREEN || type === "social_screen") {
    if (!snapshot.socialScreeningReady) {
      blockers.push(blocker(
        "social_screening_keys",
        "Connect Social screening (Serper + ScrapingBee) or set platform keys",
        integrationsHref(businessId, "social_screening"),
      ));
    }
  } else if (type === PATH_STEP_TYPES.NOTIFY_TEAM) {
    if (needsSms && !hasAny(types, ["sms_channel", "twilio_sms"])) {
      blockers.push(blocker(
        "sms_not_connected",
        "Connect SMS messaging",
        integrationsHref(businessId, "sms_channel"),
      ));
    }
    if (needsEmail && !needsSms && !hasAny(types, ["business_email", "gmail"])) {
      // Team notify via email: prefer business email but Work still works — soft warn only if channel is email.
      if (String(step.channel ?? "email").includes("email") && !hasAny(types, ["business_email", "gmail"])) {
        blockers.push(blocker(
          "email_not_connected",
          "Connect business email for team alerts",
          integrationsHref(businessId, "business_email"),
        ));
      }
    }
  } else {
    if ((type === PATH_STEP_TYPES.SEND_EMAIL || needsEmail) && type !== PATH_STEP_TYPES.SEND_SMS) {
      if (!hasAny(types, ["business_email", "gmail"])) {
        blockers.push(blocker(
          "email_not_connected",
          "Connect business email",
          integrationsHref(businessId, "business_email"),
        ));
      }
    }
    if (type === PATH_STEP_TYPES.SEND_SMS || needsSms) {
      if (!hasAny(types, ["sms_channel", "twilio_sms"])) {
        blockers.push(blocker(
          "sms_not_connected",
          "Connect SMS messaging",
          integrationsHref(businessId, "sms_channel"),
        ));
      } else if (snapshot.smsBrandComplete === false) {
        blockers.push(blocker(
          "sms_a2p_incomplete",
          "Finish A2P brand fields for SMS",
          integrationsHref(businessId, "sms_channel"),
        ));
      }
    }
  }

  return deepFreeze({
    ready: blockers.length === 0,
    blockers,
  });
}

/**
 * Attach readiness to a presented path (mutates shape via new objects).
 */
export function attachAutomationPathReadiness(presented, snapshot = {}) {
  if (!presented || typeof presented !== "object") return presented;
  const trigger = presented.trigger ?? {};
  const triggerReadiness = computeTriggerReadiness(trigger, snapshot);
  const steps = Array.isArray(presented.steps)
    ? presented.steps.map((step) => {
      const readiness = computeStepReadiness(step, snapshot);
      return deepFreeze({ ...step, readiness });
    })
    : [];

  return deepFreeze({
    ...presented,
    trigger: deepFreeze({ ...trigger, readiness: triggerReadiness }),
    steps,
  });
}

/**
 * Build snapshot from workspace-ish inputs.
 */
export function buildPathReadinessSnapshot({
  businessId = null,
  connections = [],
  connectedTypes = [],
  appOrigin = process.env.APP_ORIGIN || process.env.NEXTAUTH_URL || "",
  crmAvailable = true,
  socialScreeningReady = false,
  smsBrandComplete = null,
} = {}) {
  const origin = String(appOrigin ?? "").trim();
  return deepFreeze({
    businessId,
    connections,
    connectedTypes,
    appOrigin: origin,
    publicOriginOk: Boolean(origin) && !/localhost|127\.0\.0\.1/i.test(origin),
    crmAvailable: crmAvailable !== false,
    socialScreeningReady: Boolean(socialScreeningReady),
    smsBrandComplete,
  });
}
