import { createAnalyticsDataPoint } from "../AnalyticsDataPoint.js";

import {
  ANALYTICS_DATA_POINT_METRIC_BY_PLATFORM_EVENT,
} from "./AnalyticsEventDefaults.js";

function fail(message) {
  throw new Error(`AnalyticsEventMapper: ${message}`);
}

function safeString(v) {
  return v === null || v === undefined ? "" : String(v);
}

function isPlainObject(v) {
  return Boolean(v) && typeof v === "object" && !Array.isArray(v);
}

function toDimensionValue(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === "string") return v;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  return safeString(v);
}

function addDim(dimensions, key, value) {
  const v = toDimensionValue(value);
  if (v === null || v === "" || v === undefined) return;
  dimensions.push({ dimensionId: String(key), value: v });
}

function getCompanyId(event) {
  const md = event?.metadata ?? {};
  if (typeof md.companyId === "string") return md.companyId;
  if (typeof md?.derivedFrom?.companyId === "string") return md.derivedFrom.companyId;
  if (typeof md?.derivedFrom?.company?.id === "string") return md.derivedFrom.company.id;
  return null;
}

function getIndustry(event) {
  const md = event?.metadata ?? {};
  if (typeof md.industry === "string") return md.industry;
  if (typeof md?.derivedFrom?.industry === "string") return md.derivedFrom.industry;
  return null;
}

function mapDimensionsForPlatformEvent(event) {
  const dims = [];

  addDim(dims, "companyId", getCompanyId(event));
  addDim(dims, "industry", getIndustry(event));

  const et = String(event?.eventType ?? "");
  const payload = event?.payload ?? {};

  // Common optional fields.
  const providerType = isPlainObject(payload?.metadata) ? payload.metadata.providerType : event?.metadata?.providerType;
  addDim(dims, "providerType", providerType);

  if (et === "REQUEST_RECEIVED" || et === "REQUEST_QUALIFIED" || et === "REQUEST_CONVERTED" || et === "REQUEST_REJECTED") {
    const req = isPlainObject(payload?.request) ? payload.request : payload?.request ?? {};
    addDim(dims, "requestType", req.requestType ?? payload.requestType);
    addDim(dims, "priority", req.priority ?? payload.priority);
    addDim(dims, "channel", req.channel ?? payload.channel);

    // If conversion has team member assignment.
    addDim(dims, "employeeId", payload.assignedTeamMemberId ?? payload.assignedTeamMemberId ?? null);
    addDim(dims, "workType", req.workType ?? payload.workType);
  }

  if (et === "WORK_CREATED") {
    const w = isPlainObject(payload?.work) ? payload.work : payload?.work ?? payload;
    addDim(dims, "workType", w.workType ?? payload.workType);
    addDim(dims, "priority", w.priority ?? payload.priority);
    addDim(dims, "employeeId", w.assignedTo ?? payload.assignedTo);
  }

  if (et === "WORK_ASSIGNED") {
    const a = payload?.assignment ?? payload?.workAssignment ?? payload?.assigned;
    if (isPlainObject(a)) {
      addDim(dims, "employeeId", a.assigneeId);
      addDim(dims, "providerType", a.assigneeType);
      addDim(dims, "priority", a.priority);
    }
  }

  if (et === "WORK_COMPLETED") {
    // Only workId is in the catalog contract; optionally provided in metadata.
    const wType = isPlainObject(event?.metadata)?.derivedFrom?.workType;
    addDim(dims, "workType", wType);
  }

  if (et === "COMMUNICATION_SENT" || et === "COMMUNICATION_FAILED" || et === "COMMUNICATION_RECEIVED") {
    addDim(dims, "channel", payload.channel ?? "");
    addDim(dims, "employeeId", payload.recipient ?? null);
  }

  if (et === "TEAM_MEMBER_CREATED") {
    const m = isPlainObject(payload?.member) ? payload.member : {};
    addDim(dims, "employeeId", m.id ?? payload.memberId);
    addDim(dims, "teamId", m.departmentId ?? m.teamId ?? null);
  }

  if (et === "TEAM_MEMBER_ADDED") {
    const m = isPlainObject(payload?.member) ? payload.member : {};
    addDim(dims, "employeeId", m.id ?? payload.memberId);
    addDim(dims, "teamId", m.departmentId ?? m.teamId ?? null);
  }

  if (et === "TEAM_MEMBER_ARCHIVED") {
    addDim(dims, "employeeId", payload.memberId ?? null);
  }

  if (et === "CAPABILITY_REGISTERED") {
    const cap = isPlainObject(payload?.capability) ? payload.capability : {};
    addDim(dims, "capabilityCategory", cap.category ?? cap.categoryId ?? null);
  }

  if (et === "CAPABILITY_ARCHIVED") {
    const cat = isPlainObject(event?.metadata)?.derivedFrom?.capabilityCategory;
    addDim(dims, "capabilityCategory", cat ?? null);
  }

  if (et === "CONNECTION_CONNECTED" || et === "CONNECTION_VERIFIED" || et === "CONNECTION_FAILED") {
    addDim(dims, "connectionType", payload.connectionType ?? payload.displayName);
    addDim(dims, "providerType", payload.providerType ?? providerType);
  }

  if (et === "EXTERNAL_ACTION_REQUESTED" || et === "EXTERNAL_ACTION_COMPLETED" || et === "EXTERNAL_ACTION_FAILED") {
    addDim(dims, "providerType", payload.providerId ?? providerType);
    addDim(dims, "capabilityCategory", payload.capability ?? null);
  }

  if (et === "INBOUND_EVENT_RECEIVED" || et === "INBOUND_EVENT_REJECTED") {
    addDim(dims, "providerType", payload.provider ?? providerType);
    addDim(dims, "channel", payload.channel ?? null);
  }

  return dims;
}

function deterministicDataPointId({ metricId, eventId }) {
  const safe = `${metricId}_${eventId}`.replace(/[^a-zA-Z0-9_]/g, "");
  return `dp_${safe}`;
}

export function mapPlatformEventToAnalyticsDataPoint(event = {}, { nowISO } = {}) {
  const et = String(event?.eventType ?? "");
  const metricDef = ANALYTICS_DATA_POINT_METRIC_BY_PLATFORM_EVENT[et];
  if (!metricDef) return null;

  if (!event?.eventId) fail("platform event.eventId required.");
  const timestampISO = String(event?.occurredAt ?? nowISO ?? "");
  if (!timestampISO) fail("platform event.occurredAt required.");

  const metricId = metricDef.metricId;

  const dimensions = mapDimensionsForPlatformEvent(event);

  const dataPoint = createAnalyticsDataPoint({
    id: deterministicDataPointId({ metricId, eventId: event.eventId }),
    metricId,
    value: 1,
    timestamp: timestampISO,
    dimensions,
    sourceEventId: String(event.eventId),
    sourceObject: {
      eventType: et,
      aggregateType: String(event?.aggregateType ?? ""),
      aggregateId: String(event?.aggregateId ?? ""),
      publisher: String(event?.publisher ?? ""),
    },
    metadata: {
      derivedFrom: { eventType: et },
    },
    metricDimensionsForValidation: [], // allow arbitrary dimensionId (metrics can declare none)
  });

  return { metricId, dataPoint };
}

