import { deepFreeze } from "../workspace/_utils/deepFreeze.js";

const DEFAULT_ACTIVITY_LABELS = deepFreeze({
  REQUEST_RECEIVED: { title: "Request received", actorType: "SYSTEM", category: "request" },
  REQUEST_QUALIFIED: { title: "Request reviewed", actorType: "SYSTEM", category: "request" },
  REQUEST_CONVERTED: { title: "Request converted to work", actorType: "SYSTEM", category: "request" },
  REQUEST_REJECTED: { title: "Request declined", actorType: "SYSTEM", category: "request" },
  WORK_CREATED: { title: "Work created", actorType: "SYSTEM", category: "work" },
  WORK_ASSIGNED: { title: "Work assigned", actorType: "SYSTEM", category: "work" },
  WORK_COMPLETED: { title: "Work completed", actorType: "HUMAN", category: "work" },
  INTERACTION_RECORDED: { title: "Interaction recorded", actorType: "HUMAN", category: "interaction" },
  INTERACTION_OUTCOME_RECORDED: { title: "Outcome recorded", actorType: "HUMAN", category: "interaction" },
  FOLLOW_UP_SCHEDULED: { title: "Follow-up scheduled", actorType: "SYSTEM", category: "follow_up" },
  AUTOMATION_RUN_STARTED: { title: "Automation started", actorType: "AUTOMATION", category: "automation" },
  AUTOMATION_RUN_COMPLETED: { title: "Automation completed", actorType: "AUTOMATION", category: "automation" },
  AUTOMATION_RUN_FAILED: { title: "Automation failed", actorType: "AUTOMATION", category: "automation" },
  APPROVAL_REQUESTED: { title: "Approval requested", actorType: "SYSTEM", category: "approval" },
  APPROVAL_GRANTED: { title: "Approval granted", actorType: "HUMAN", category: "approval" },
  APPROVAL_REJECTED: { title: "Approval rejected", actorType: "HUMAN", category: "approval" },
  COMMUNICATION_SENT: { title: "Communication sent", actorType: "SYSTEM", category: "communication" },
  COMMUNICATION_FAILED: { title: "Communication failed", actorType: "SYSTEM", category: "communication" },
  COMMUNICATION_RECEIVED: { title: "Communication received", actorType: "SYSTEM", category: "communication" },
  CONNECTION_CONNECTED: { title: "Connection established", actorType: "SYSTEM", category: "connection" },
  CONNECTION_VERIFIED: { title: "Connection verified", actorType: "SYSTEM", category: "connection" },
  CONNECTION_FAILED: { title: "Connection failed", actorType: "SYSTEM", category: "connection" },
  EXTERNAL_ACTION_COMPLETED: { title: "External action completed", actorType: "SYSTEM", category: "action" },
  EXTERNAL_ACTION_FAILED: { title: "External action failed", actorType: "SYSTEM", category: "action" },
  INBOUND_EVENT_RECEIVED: { title: "New inquiry received", actorType: "SYSTEM", category: "inbound" },
});

function terminologyOverride(terminology, eventType, field) {
  const activity = terminology?.activityLabels?.[eventType];
  if (activity && activity[field]) return String(activity[field]);
  return null;
}

export function mapEventToBusinessActivity({ eventType, terminology, payload, occurredAt, actorName, actorTypeOverride } = {}) {
  const et = String(eventType ?? "");
  const defaults = DEFAULT_ACTIVITY_LABELS[et] ?? { title: "Business activity", actorType: "SYSTEM", category: "general" };
  const title = terminologyOverride(terminology, et, "title") ?? defaults.title;
  const actorType = actorTypeOverride ?? terminologyOverride(terminology, et, "actorType") ?? defaults.actorType;

  return deepFreeze({
    eventType: et,
    displayTitle: title,
    displaySummary: buildActivitySummary(et, payload),
    actorType,
    actorName: actorName ?? deriveActorName(actorType),
    occurredAt: occurredAt ?? null,
    category: defaults.category,
    technicalEventType: et,
  });
}

function deriveActorName(actorType) {
  if (actorType === "AUTOMATION") return "VIBETech Automation";
  if (actorType === "DIGITAL_EMPLOYEE") return "Digital Employee";
  if (actorType === "HUMAN") return "Team Member";
  return "VIBETech";
}

function buildActivitySummary(eventType, payload) {
  const p = payload && typeof payload === "object" ? payload : {};
  if (eventType === "WORK_CREATED") return String(p.work?.title ?? p.title ?? "New work item created.");
  if (eventType === "WORK_ASSIGNED") return "Work was assigned to the appropriate owner.";
  if (eventType === "REQUEST_CONVERTED") return "An incoming request became active work.";
  if (eventType === "AUTOMATION_RUN_COMPLETED") return "An automated workflow step completed successfully.";
  if (eventType === "APPROVAL_REQUESTED") return "Your decision is needed before execution continues.";
  if (eventType === "CONNECTION_VERIFIED") return String(p.connectionType ?? p.displayName ?? "A required connection was verified.");
  if (eventType === "EXTERNAL_ACTION_COMPLETED") return "An external action completed successfully.";
  if (eventType === "INBOUND_EVENT_RECEIVED") {
    const kind = String(p.normalizedFacts?.eventKind ?? p.eventType ?? "");
    if (kind === "form_submission") return "A new inquiry came in from the website.";
    if (kind === "missed_call") return "A missed call was received.";
    return "A new inbound business event arrived.";
  }
  return "";
}

export function assertNoRawEventNamesInPresentation(item) {
  const forbidden = [
    "REQUEST_CONVERTED",
    "WORK_CREATED",
    "INTERACTION_OUTCOME_RECORDED",
    "AUTOMATION_RUN_COMPLETED",
    "CONNECTION_VERIFIED",
  ];
  const text = JSON.stringify(item ?? {});
  for (const f of forbidden) {
    if (text.includes(f)) return false;
  }
  return true;
}
