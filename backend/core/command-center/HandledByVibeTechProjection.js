import { deepFreeze } from "../workspace/_utils/deepFreeze.js";
import { mapEventToBusinessActivity } from "../presentation/BusinessActivityLanguageMapper.js";

const HANDLED_EVENT_TYPES = new Set([
  "REQUEST_CONVERTED",
  "WORK_CREATED",
  "WORK_ASSIGNED",
  "WORK_COMPLETED",
  "INTERACTION_RECORDED",
  "INTERACTION_OUTCOME_RECORDED",
  "FOLLOW_UP_SCHEDULED",
  "AUTOMATION_RUN_COMPLETED",
  "APPROVAL_GRANTED",
  "COMMUNICATION_SENT",
  "CONNECTION_VERIFIED",
  "EXTERNAL_ACTION_COMPLETED",
]);

function safeArray(v) {
  return Array.isArray(v) ? v : [];
}

function compareDesc(a, b) {
  const ta = new Date(String(a.occurredAt)).getTime();
  const tb = new Date(String(b.occurredAt)).getTime();
  return tb - ta;
}

/**
 * Read-only projection of meaningful completed operational actions.
 */
export function projectHandledByVibeTech({ platformEventStore, terminology, limit = 20 } = {}) {
  const events = safeArray(platformEventStore?.getEvents?.())
    .filter((e) => HANDLED_EVENT_TYPES.has(String(e.eventType)))
    .sort(compareDesc)
    .slice(0, limit);

  const items = events.map((evt) => {
    const activity = mapEventToBusinessActivity({
      eventType: evt.eventType,
      terminology,
      payload: evt.payload,
      occurredAt: evt.occurredAt,
    });

    return deepFreeze({
      id: `handled_${evt.eventId}`,
      title: activity.displayTitle,
      summary: activity.displaySummary,
      actorType: activity.actorType,
      actorName: activity.actorName,
      occurredAt: evt.occurredAt,
      result: deriveResult(evt),
      relatedContext: deriveRelatedContext(evt),
    });
  });

  return deepFreeze(items);
}

function deriveResult(evt) {
  const et = String(evt.eventType);
  if (et === "AUTOMATION_RUN_COMPLETED") return "completed";
  if (et === "WORK_COMPLETED") return "completed";
  if (et === "EXTERNAL_ACTION_COMPLETED") return "completed";
  if (et === "COMMUNICATION_SENT") return "sent";
  if (et === "APPROVAL_GRANTED") return "approved";
  return "handled";
}

function deriveRelatedContext(evt) {
  const p = evt.payload ?? {};
  const refs = [];
  if (p.work?.id) refs.push({ type: "work", id: String(p.work.id), label: p.work.title ?? null });
  if (p.request?.id) refs.push({ type: "request", id: String(p.request.id) });
  if (p.connectionId) refs.push({ type: "connection", id: String(p.connectionId) });
  if (evt.aggregateId) refs.push({ type: evt.aggregateType ?? "entity", id: String(evt.aggregateId) });
  return refs;
}
