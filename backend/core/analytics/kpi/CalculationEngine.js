import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";
import { METRIC_AVAILABILITY } from "./MetricDefinition.js";

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function hoursBetween(a, b) {
  const start = Date.parse(a);
  const end = Date.parse(b);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  return Math.max(0, (end - start) / 36e5);
}

function isOpenWork(item) {
  const status = String(item.status ?? "").toUpperCase();
  return status && status !== "COMPLETED" && status !== "CANCELLED" && status !== "DONE";
}

/**
 * Deterministic metric calculation from canonical evidence bags.
 * Never fabricates values — returns availability states when evidence is missing.
 */
export function calculateMetric(definition, evidence = {}, { nowISO = new Date().toISOString(), role = "OWNER" } = {}) {
  if (!definition) {
    return unavailable("unsupported", "Metric definition missing.");
  }

  if (!definition.permissions.includes(String(role)) && role !== "OWNER") {
    return unavailable("unavailable", `Role ${role} cannot view ${definition.metricId}.`, definition);
  }

  if (definition.requiresFinancialEvidence && !hasFinancialEvidence(evidence)) {
    return unavailable("needs_setup", "Financial evidence is not connected — revenue/cost metrics stay hidden.", definition);
  }

  const freshness = evaluateFreshness(definition, evidence, nowISO);
  if (freshness === METRIC_AVAILABILITY.stale) {
    const result = computeValue(definition, evidence, nowISO);
    if (result.availability === METRIC_AVAILABILITY.available) {
      return deepFreeze({
        ...result,
        availability: METRIC_AVAILABILITY.stale,
        confidence: Math.min(result.confidence, 0.45),
        unavailableReason: "Evidence is stale — refresh operating data.",
      });
    }
  }

  if (!hasRequiredEvidence(definition, evidence)) {
    const reason = missingReason(definition, evidence);
    return unavailable(
      reason.includes("setup") ? METRIC_AVAILABILITY.needs_setup : METRIC_AVAILABILITY.insufficient_data,
      reason,
      definition,
    );
  }

  const result = computeValue(definition, evidence, nowISO);
  return deepFreeze(result);
}

function computeValue(definition, evidence, nowISO) {
  const workItems = asArray(evidence.workItems);
  const approvals = asArray(evidence.approvals);
  const integrations = asArray(evidence.integrations);
  const knowledgeCount = Number(evidence.knowledgeDocumentCount ?? 0);
  const memberCount = Number(evidence.memberCount ?? 0);
  const financialEvents = asArray(evidence.financialEvents);

  let value = null;
  let sampleSize = 0;
  let drillDown = [];
  let comparisonValue = null;
  let trend = "flat";

  switch (definition.metricId) {
    case "open_work_count": {
      const open = workItems.filter(isOpenWork);
      value = open.length;
      sampleSize = open.length;
      drillDown = open.slice(0, 10).map((item) => ({ id: item.id, label: item.title ?? item.label ?? item.id }));
      break;
    }
    case "overdue_work_count": {
      const now = Date.parse(nowISO);
      const overdue = workItems.filter((item) => {
        if (!isOpenWork(item) || !item.dueAt) return false;
        const due = Date.parse(item.dueAt);
        return Number.isFinite(due) && due < now;
      });
      value = overdue.length;
      sampleSize = overdue.length;
      drillDown = overdue.slice(0, 10).map((item) => ({ id: item.id, label: item.title ?? item.id, dueAt: item.dueAt }));
      break;
    }
    case "unassigned_work_count": {
      const unassigned = workItems.filter((item) => isOpenWork(item) && !item.assigneeId && !item.assignee);
      value = unassigned.length;
      sampleSize = unassigned.length;
      drillDown = unassigned.slice(0, 10).map((item) => ({ id: item.id, label: item.title ?? item.id }));
      break;
    }
    case "pending_approvals_count": {
      const pending = approvals.filter((entry) => /pending|open|waiting/i.test(String(entry.status ?? "pending")));
      value = pending.length;
      sampleSize = pending.length;
      drillDown = pending.slice(0, 10).map((entry) => ({ id: entry.id, label: entry.label ?? entry.id }));
      break;
    }
    case "work_completion_rate": {
      const completed = workItems.filter((item) => /COMPLETED|DONE/i.test(String(item.status ?? "")));
      const closed = workItems.filter((item) => /COMPLETED|DONE|CANCELLED/i.test(String(item.status ?? "")));
      sampleSize = closed.length;
      if (closed.length < (definition.evidenceContract?.minSamples ?? 1)) {
        return insufficient(definition, "Not enough completed Work samples.");
      }
      value = completed.length / closed.length;
      drillDown = completed.slice(0, 5).map((item) => ({ id: item.id, label: item.title ?? item.id }));
      break;
    }
    case "avg_response_hours": {
      const pairs = workItems
        .map((item) => hoursBetween(item.openedAt ?? item.createdAt, item.firstResponseAt))
        .filter((hours) => hours != null);
      sampleSize = pairs.length;
      if (pairs.length < (definition.evidenceContract?.minSamples ?? 1)) {
        return insufficient(definition, "Not enough response-time samples.");
      }
      value = pairs.reduce((sum, hours) => sum + hours, 0) / pairs.length;
      break;
    }
    case "sla_compliance_rate": {
      const scored = workItems.filter((item) => item.slaBreached != null || item.withinSla != null);
      sampleSize = scored.length;
      if (scored.length < (definition.evidenceContract?.minSamples ?? 1)) {
        return insufficient(definition, "SLA fields are not present on Work evidence.");
      }
      const compliant = scored.filter((item) => item.withinSla === true || item.slaBreached === false);
      value = compliant.length / scored.length;
      break;
    }
    case "integration_health_count": {
      const healthy = integrations.filter((entry) => /connected|healthy/i.test(String(entry.health ?? entry.status ?? "")));
      value = healthy.length;
      sampleSize = integrations.length;
      drillDown = healthy.slice(0, 10).map((entry) => ({ id: entry.id ?? entry.providerId, label: entry.label ?? entry.providerId }));
      break;
    }
    case "failed_integrations_count": {
      const failed = integrations.filter((entry) => /error|attention|failed|degraded/i.test(String(entry.health ?? entry.status ?? "")));
      value = failed.length;
      sampleSize = integrations.length;
      drillDown = failed.slice(0, 10).map((entry) => ({ id: entry.id ?? entry.providerId, label: entry.label ?? entry.providerId }));
      break;
    }
    case "knowledge_document_count": {
      value = knowledgeCount;
      sampleSize = knowledgeCount;
      break;
    }
    case "team_capacity_utilization": {
      if (!memberCount) return insufficient(definition, "Team membership count is missing.");
      const open = workItems.filter(isOpenWork).length;
      value = open / memberCount;
      sampleSize = open;
      break;
    }
    case "business_health_score": {
      const parts = [];
      if (workItems.length) {
        const overdue = workItems.filter((item) => isOpenWork(item) && item.dueAt && Date.parse(item.dueAt) < Date.parse(nowISO)).length;
        parts.push(Math.max(0, 1 - overdue / Math.max(1, workItems.filter(isOpenWork).length)));
      }
      if (evidence.knowledgeDocumentCount != null) {
        parts.push(knowledgeCount > 0 ? 1 : 0.2);
      }
      if (integrations.length) {
        const healthy = integrations.filter((entry) => /connected|healthy/i.test(String(entry.health ?? entry.status ?? ""))).length;
        parts.push(healthy / integrations.length);
      }
      if (!parts.length) return insufficient(definition, "Composite health needs work, knowledge, or integration evidence.");
      value = parts.reduce((sum, part) => sum + part, 0) / parts.length;
      sampleSize = parts.length;
      break;
    }
    case "revenue_total": {
      if (!financialEvents.length) {
        return unavailable(METRIC_AVAILABILITY.needs_setup, "No verified financial events.", definition);
      }
      value = financialEvents.reduce((sum, entry) => sum + Number(entry.amount ?? 0), 0);
      sampleSize = financialEvents.length;
      drillDown = financialEvents.slice(0, 10).map((entry) => ({ id: entry.id, label: entry.label ?? entry.id, amount: entry.amount }));
      break;
    }
    default:
      return unavailable(METRIC_AVAILABILITY.unsupported, `No calculator for ${definition.metricId}.`, definition);
  }

  if (value == null || Number.isNaN(Number(value))) {
    return insufficient(definition, "Calculation produced no value.");
  }

  if (definition.target != null) {
    trend = Number(value) >= Number(definition.target) ? "up" : "down";
  }

  const alert = evaluateThreshold(definition, value);

  return deepFreeze({
    metricId: definition.metricId,
    label: definition.label,
    availability: METRIC_AVAILABILITY.available,
    value: Number(value),
    valueType: definition.valueType,
    unit: unitFor(definition),
    target: definition.target,
    comparisonValue,
    trend,
    alert,
    timeRange: { window: definition.timeWindow, asOf: nowISO },
    freshness: evidence.asOf ?? nowISO,
    confidence: confidenceFor(sampleSize, definition),
    sampleSize,
    calculation: explainCalculation(definition),
    drillDownEvidence: drillDown,
    unavailableReason: null,
    fabricated: false,
  });
}

function evaluateThreshold(definition, value) {
  const thresholds = definition.thresholds ?? {};
  if (thresholds.criticalAbove != null && value > thresholds.criticalAbove) {
    return deepFreeze({ level: "critical", message: `${definition.label} above critical threshold.` });
  }
  if (thresholds.warnAbove != null && value > thresholds.warnAbove) {
    return deepFreeze({ level: "warning", message: `${definition.label} above warning threshold.` });
  }
  if (thresholds.criticalBelow != null && value < thresholds.criticalBelow) {
    return deepFreeze({ level: "critical", message: `${definition.label} below critical threshold.` });
  }
  if (thresholds.warnBelow != null && value < thresholds.warnBelow) {
    return deepFreeze({ level: "warning", message: `${definition.label} below warning threshold.` });
  }
  return null;
}

function hasFinancialEvidence(evidence) {
  return asArray(evidence.financialEvents).length > 0 && evidence.financialVerified === true;
}

function hasRequiredEvidence(definition, evidence) {
  const required = definition.evidenceContract?.requiredEvidence ?? [];
  for (const key of required) {
    if (key === "workItems" && !asArray(evidence.workItems).length && evidence.workItems !== undefined) {
      // empty array is valid evidence (zero open work) — still "has" the source
      continue;
    }
    if (key === "workItems" && evidence.workItems === undefined) return false;
    if (key === "approvals" && evidence.approvals === undefined) return false;
    if (key === "integrations" && evidence.integrations === undefined) return false;
    if (key === "knowledgeDocumentCount" && evidence.knowledgeDocumentCount === undefined) return false;
    if (key === "memberCount" && evidence.memberCount === undefined) return false;
    if (key === "financialEvents" && !hasFinancialEvidence(evidence)) return false;
  }
  return true;
}

function missingReason(definition, evidence) {
  const required = definition.evidenceContract?.requiredEvidence ?? [];
  const missing = required.filter((key) => {
    if (key === "financialEvents") return !hasFinancialEvidence(evidence);
    return evidence[key] === undefined;
  });
  if (missing.includes("financialEvents")) return "Connect verified financial evidence before showing revenue.";
  if (missing.includes("integrations")) return "Integrations need setup before health KPIs are available.";
  if (missing.length) return `Missing evidence: ${missing.join(", ")}.`;
  return "Insufficient evidence.";
}

function evaluateFreshness(definition, evidence, nowISO) {
  const maxHours = definition.evidenceContract?.freshnessHours ?? 48;
  const asOf = evidence.asOf;
  if (!asOf) return METRIC_AVAILABILITY.available;
  const age = hoursBetween(asOf, nowISO);
  if (age != null && age > maxHours) return METRIC_AVAILABILITY.stale;
  return METRIC_AVAILABILITY.available;
}

function confidenceFor(sampleSize, definition) {
  const min = definition.evidenceContract?.minSamples ?? 1;
  if (sampleSize >= min * 3) return 0.9;
  if (sampleSize >= min) return 0.75;
  return 0.55;
}

function unitFor(definition) {
  switch (definition.valueType) {
    case "percentage":
    case "completion_rate":
    case "sla_compliance":
    case "conversion_rate":
      return "ratio";
    case "duration":
    case "response_time":
      return "hours";
    case "revenue":
    case "cost":
      return "currency";
    default:
      return "count";
  }
}

function explainCalculation(definition) {
  return `${definition.aggregation} over ${definition.sourceRuntime} fields [${definition.sourceFields.join(", ")}] in window ${definition.timeWindow}.`;
}

function unavailable(availability, reason, definition = null) {
  return deepFreeze({
    metricId: definition?.metricId ?? null,
    label: definition?.label ?? null,
    availability,
    value: null,
    valueType: definition?.valueType ?? null,
    unit: definition ? unitFor(definition) : null,
    target: definition?.target ?? null,
    comparisonValue: null,
    trend: null,
    alert: null,
    timeRange: null,
    freshness: null,
    confidence: 0,
    sampleSize: 0,
    calculation: definition ? explainCalculation(definition) : null,
    drillDownEvidence: [],
    unavailableReason: reason,
    fabricated: false,
    emptyState: definition?.emptyState ?? reason,
  });
}

function insufficient(definition, reason) {
  return unavailable(METRIC_AVAILABILITY.insufficient_data, reason, definition);
}
