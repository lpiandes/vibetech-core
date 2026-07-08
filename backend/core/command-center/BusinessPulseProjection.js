import { deepFreeze } from "../workspace/_utils/deepFreeze.js";

function safeArray(v) {
  return Array.isArray(v) ? v : [];
}

function isOpenWork(w) {
  return !["completed", "cancelled", "closed"].includes(String(w?.status ?? ""));
}

function isOpenRequest(r) {
  return !["closed", "cancelled", "rejected"].includes(String(r?.status ?? ""));
}

function computeMetricValue(source, { ctx, attentionItems }) {
  const requests = safeArray(ctx?.requestRuntime?.getRequests?.());
  const workItems = safeArray(ctx?.workRuntime?.getWorkItems?.());
  const messages = safeArray(ctx?.communicationRuntime?.getMessages?.());

  switch (String(source)) {
    case "inbound_requests_open":
      return requests.filter((r) => r.inboundAttribution && isOpenRequest(r)).length;
    case "attention_count":
      return safeArray(attentionItems).length;
    case "outbound_communications":
      return messages.filter((m) => String(m.direction) === "outbound").length;
    case "work_showing_open":
      return workItems.filter((w) => String(w.workType) === "showing_coordination" && isOpenWork(w)).length;
    case "work_urgent_open":
      return workItems.filter((w) => w.priority === "urgent" && isOpenWork(w)).length;
  case "open_work":
      return workItems.filter(isOpenWork).length;
    default:
      return 0;
  }
}

/**
 * Package-configured business pulse — no hardcoded KPI labels in Core.
 */
export function projectBusinessPulse({ pulseMetricDefs, ctx, attentionItems, limit = 5 } = {}) {
  const defs = safeArray(pulseMetricDefs).slice(0, limit);
  return deepFreeze(
    defs.map((def) => ({
      id: String(def.id),
      label: String(def.label),
      value: String(computeMetricValue(def.source, { ctx, attentionItems })),
      trend: null,
      source: String(def.source),
    })),
  );
}
