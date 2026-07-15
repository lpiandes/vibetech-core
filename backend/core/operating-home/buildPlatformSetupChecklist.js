import { deepFreeze } from "../workspace/_utils/deepFreeze.js";
import { getSetupGuide } from "../ai-builder/setupWalkthroughGuides.js";

const CONNECTION_BY_STEP = Object.freeze({
  email: "business_email",
  calendar: "calendar",
  sms: "sms_channel",
  voice: "voice_channel",
  meta_lead_ads: "meta_lead_ads",
});

const STEP_LABELS = Object.freeze({
  team: { title: "Invite your team", actionLabel: "Invite teammate", path: "team" },
  knowledge: { title: "Add business knowledge", actionLabel: "Add document", path: "knowledge?add=1" },
  email: { title: "Connect business email", actionLabel: "Connect", path: "integrations?focus=business_email" },
  calendar: { title: "Connect Google Calendar", actionLabel: "Connect", path: "integrations?focus=calendar" },
  sms: { title: "Connect text messaging (Twilio)", actionLabel: "Connect", path: "integrations?focus=sms_channel" },
  voice: { title: "Connect phone (Twilio)", actionLabel: "Connect", path: "integrations?focus=voice_channel" },
  a2p_registration: {
    title: "Complete Twilio A2P / 10DLC registration",
    actionLabel: "Finish A2P",
    path: "integrations?focus=sms_channel&a2p=1",
  },
  meta_lead_ads: {
    title: "Connect Facebook Lead Ads",
    actionLabel: "Connect",
    path: "integrations?focus=meta_lead_ads",
  },
  scheduling: {
    title: "Turn on scheduling + connect calendar",
    actionLabel: "Connect calendar",
    path: "integrations?focus=calendar",
  },
});

/**
 * Derive platform setup steps from Business OS integration requirements.
 */
export function deriveRequiredSetupStepsFromIntegrations(integrations = []) {
  const steps = [];
  const required = (integrations ?? []).filter((entry) => {
    const status = String(entry?.status ?? "required").toLowerCase();
    return status !== "deferred" && status !== "optional" && status !== "recommended";
  });

  const ids = new Set(
    required.map((entry) => String(entry?.integrationId ?? entry?.id ?? "").toLowerCase()),
  );

  if (ids.has("business_email") || ids.has("email") || required.length === 0) {
    steps.push("email");
  }
  if (ids.has("calendar") || ids.has("google_calendar")) steps.push("calendar");
  if (ids.has("sms_channel") || ids.has("sms") || ids.has("text")) {
    steps.push("sms");
    steps.push("a2p_registration");
  }
  if (ids.has("voice_channel") || ids.has("voice") || ids.has("phone")) {
    steps.push("voice");
  }
  if (ids.has("meta_lead_ads") || ids.has("meta") || ids.has("facebook")) {
    steps.push("meta_lead_ads");
  }

  return [...new Set(steps)];
}

/**
 * Full post-live checklist ids from an installed Business OS specification.
 */
export function deriveRequiredSetupStepsFromSpecification(specification = null) {
  if (!specification || typeof specification !== "object") return ["email"];

  const fromMetadata = Array.isArray(specification.metadata?.requiredSetupSteps)
    ? specification.metadata.requiredSetupSteps.map(String)
    : [];
  const fromIntegrations = deriveRequiredSetupStepsFromIntegrations(
    specification.integrationRequirements ?? [],
  );
  const steps = [...fromMetadata, ...fromIntegrations];

  const caps = new Set(
    (specification.capabilityRequirements ?? []).map((entry) => String(entry?.capabilityId ?? entry?.id ?? "")),
  );
  if (caps.has("scheduling") || caps.has("pkg.scheduling")) {
    steps.push("scheduling");
    if (!steps.includes("calendar")) steps.push("calendar");
  }

  return [...new Set(steps.length ? steps : ["email"])];
}

function isConnectionConnected(connections, connectionId) {
  return (connections ?? []).some(
    (entry) => String(entry?.id ?? entry?.connectionType ?? "") === String(connectionId)
      && String(entry?.status ?? "").toUpperCase() === "CONNECTED",
  );
}

function resolveA2pStatus({ connections = [], connectionRuntime = null } = {}) {
  const snapshot = (connections ?? []).find((entry) => String(entry?.id) === "sms_channel");
  if (snapshot?.a2pRegistrationStatus) {
    return String(snapshot.a2pRegistrationStatus);
  }
  const runtimeConn = connectionRuntime?.getConnectionByType?.("sms_channel") ?? null;
  const fromMeta = runtimeConn?.metadata?.a2pRegistrationStatus
    ?? runtimeConn?.credentialReference?.metadata?.a2pRegistrationStatus;
  return fromMeta ? String(fromMeta) : "pending";
}

/**
 * Build owner-facing platform incomplete checklist for Home.
 */
export function buildPlatformSetupChecklist({
  workspaceId,
  requiredSetupSteps = ["email"],
  connections = [],
  connectionRuntime = null,
  teamInviteChecklistComplete = false,
  knowledgeCount = 0,
  includeTeamAndKnowledge = true,
} = {}) {
  const base = workspaceId ? `/b/${encodeURIComponent(workspaceId)}` : "";
  const steps = new Set(requiredSetupSteps ?? ["email"]);
  const a2pStatus = resolveA2pStatus({ connections, connectionRuntime });
  const smsConnected = isConnectionConnected(connections, "sms_channel");

  const checklist = [];

  if (includeTeamAndKnowledge) {
    checklist.push({
      id: "team",
      title: STEP_LABELS.team.title,
      actionLabel: STEP_LABELS.team.actionLabel,
      href: `${base}/${STEP_LABELS.team.path}`,
      complete: Boolean(teamInviteChecklistComplete),
      ...guideFields("team", STEP_LABELS.team.title),
    });
    checklist.push({
      id: "knowledge",
      title: STEP_LABELS.knowledge.title,
      actionLabel: STEP_LABELS.knowledge.actionLabel,
      href: `${base}/${STEP_LABELS.knowledge.path}`,
      complete: Number(knowledgeCount) > 0,
      ...guideFields("knowledge", STEP_LABELS.knowledge.title),
    });
  }

  for (const stepId of ["email", "calendar", "sms", "voice", "a2p_registration", "meta_lead_ads", "scheduling"]) {
    if (!steps.has(stepId)) continue;
    const label = STEP_LABELS[stepId];
    if (!label) continue;

    let complete = false;
    if (stepId === "a2p_registration") {
      complete = smsConnected && a2pStatus === "complete";
    } else if (stepId === "scheduling") {
      // In-app schedule is usable; treat complete once calendar is connected or schedule was opened is tracked via calendar.
      complete = isConnectionConnected(connections, "calendar");
    } else {
      const connectionId = CONNECTION_BY_STEP[stepId];
      complete = connectionId ? isConnectionConnected(connections, connectionId) : false;
    }

    checklist.push({
      id: stepId,
      title: label.title,
      actionLabel: label.actionLabel,
      href: `${base}/${label.path}`,
      complete,
      ...guideFields(stepId, label.title),
    });
  }

  return deepFreeze(checklist);
}

function guideFields(stepId, fallbackTitle) {
  const guide = getSetupGuide(stepId);
  if (!guide) {
    return {
      summary: null,
      whereInApp: null,
      inApp: [],
      external: [],
    };
  }
  return {
    title: guide.title ?? fallbackTitle,
    summary: guide.summary ?? null,
    whereInApp: guide.whereInApp ?? null,
    inApp: Array.isArray(guide.inApp) ? guide.inApp : [],
    external: Array.isArray(guide.external) ? guide.external : [],
  };
}

export function platformSetupIncompleteSummary(checklist = []) {
  const incomplete = (checklist ?? []).filter((item) => item && item.complete !== true);
  if (!incomplete.length) return null;
  const titles = incomplete.map((item) => String(item.title ?? item.id));
  return deepFreeze({
    incompleteCount: incomplete.length,
    headline: "Platform incomplete — finish connections to operate.",
    detail: `Finish ${titles.slice(0, 3).join(", ")}${titles.length > 3 ? ` and ${titles.length - 3} more` : ""}.`,
    nextItem: incomplete[0] ?? null,
  });
}
