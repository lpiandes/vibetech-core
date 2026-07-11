import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";
import { isRegisteredDashboardComponent } from "../../business-os/BusinessOSDashboardComponentRegistry.js";
import {
  getMetricDefinition,
  listMetricIds,
  resolveAnalyticsTemplate,
} from "./MetricCatalog.js";
import { createAnalyticsRecommendation } from "./AnalyticsRecommendation.js";
import { calculateMetric } from "./CalculationEngine.js";
import { evaluateAlerts } from "./AlertEngine.js";
import { mapAnalyticsToBusinessOS } from "./mapAnalyticsToBusinessOS.js";
import { AnalyticsDefinitionStore } from "./AnalyticsDefinitionStore.js";
import { METRIC_AVAILABILITY } from "./MetricDefinition.js";

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function industryOf({ dna = null, businessSummary = {} } = {}) {
  return String(
    businessSummary.industry
    ?? dna?.company?.industry
    ?? "default",
  );
}

function createExecutiveDashboardDefinition({
  dashboardId,
  label,
  audience = "owner",
  cards = [],
} = {}) {
  return deepFreeze({
    dashboardId: String(dashboardId),
    label: String(label),
    audience: String(audience),
    cards: deepFreeze(cards),
  });
}

/**
 * Universal Analytics & KPI Engine — one platform for every business.
 * Recommends metrics, calculates from evidence, maps to registered dashboards.
 * Never fabricates metrics. Prefer read-only projections.
 */
export class AnalyticsEngine {
  constructor({ store = new AnalyticsDefinitionStore() } = {}) {
    this.store = store;
  }

  recommendAnalytics({
    dna = null,
    businessSummary = {},
    evidence = {},
    businessId = null,
    role = "OWNER",
    modules = [],
  } = {}) {
    const industry = industryOf({ dna, businessSummary });
    const template = resolveAnalyticsTemplate(industry);
    const baseEvidence = [
      `industry:${industry}`,
      ...(dna ? ["source:business_dna"] : ["source:business_summary"]),
      ...(businessId ? [`tenant:${businessId}`] : ["tenant:preview"]),
    ];

    const recommendations = [];
    const metrics = [];

    for (const metricId of template.metricIds) {
      const definition = this.store.getMetricDefinition(metricId) ?? getMetricDefinition(metricId);
      if (!definition) continue;

      const targetOverride = this.store.getTarget(metricId);
      const withTarget = targetOverride
        ? { ...definition, target: targetOverride.target }
        : definition;
      metrics.push(withTarget);

      recommendations.push(createAnalyticsRecommendation({
        recommendationId: `rec_metric_${metricId}`,
        kind: categoryKind(definition.category),
        label: definition.label,
        reason: reasonFor(definition),
        confidence: 0.82,
        evidence: [...baseEvidence, `metric:${metricId}`, `source:${definition.sourceRuntime}`],
        alternatives: alternativesFor(definition),
        calculationExplanation: `${definition.aggregation} on ${definition.sourceFields.join(", ")} (${definition.timeWindow}).`,
        requiredData: definition.evidenceContract?.requiredEvidence ?? [],
        payload: { metric: withTarget },
        selected: true,
        assumptions: ["Values appear only when canonical evidence exists.", "Zeros are shown only when the source bag is present and empty."],
      }));
    }

    // Never auto-recommend revenue unless financial evidence exists.
    if (asArray(evidence.financialEvents).length && evidence.financialVerified === true) {
      const revenue = getMetricDefinition("revenue_total");
      if (revenue && !metrics.some((entry) => entry.metricId === "revenue_total")) {
        metrics.push(revenue);
        recommendations.push(createAnalyticsRecommendation({
          recommendationId: "rec_metric_revenue_total",
          kind: "executive_kpi",
          label: revenue.label,
          reason: "Verified financial evidence is present — revenue may be shown.",
          confidence: 0.7,
          evidence: [...baseEvidence, "financial_verified:true"],
          alternatives: ["Hide until accounting integration is connected"],
          calculationExplanation: "Sum of verified financial event amounts.",
          requiredData: ["financialEvents"],
          payload: { metric: revenue },
        }));
      }
    } else {
      recommendations.push(createAnalyticsRecommendation({
        recommendationId: "rec_skip_fabricated_revenue",
        kind: "honesty",
        label: "Do not show fabricated revenue",
        reason: "Revenue/cost KPIs stay hidden until verified financial evidence exists.",
        confidence: 0.95,
        evidence: [...baseEvidence, "financial_verified:false"],
        alternatives: ["Connect accounting / payments integration"],
        calculationExplanation: "No calculation without financialEvents + financialVerified.",
        requiredData: ["financialEvents"],
        selected: true,
      }));
    }

    const results = metrics.map((definition) => calculateMetric(definition, evidence, { role }));
    const alerts = evaluateAlerts({ metricResults: results, evidence });

    for (const alert of alerts.slice(0, 5)) {
      recommendations.push(createAnalyticsRecommendation({
        recommendationId: `rec_alert_${alert.alertId}`,
        kind: "alert",
        label: alert.label,
        reason: alert.recommendedAction,
        confidence: 0.8,
        evidence: [...baseEvidence, `alert:${alert.kind}`],
        alternatives: ["Dismiss", "Open drill-down"],
        calculationExplanation: "Threshold or evidence-based alert — does not create Work silently.",
        requiredData: [],
        payload: { alert },
      }));
    }

    const reports = buildDefaultReports(metrics);
    for (const report of reports) {
      recommendations.push(createAnalyticsRecommendation({
        recommendationId: `rec_report_${report.reportId}`,
        kind: "report",
        label: report.label,
        reason: report.description,
        confidence: 0.78,
        evidence: [...baseEvidence, `report:${report.reportId}`],
        alternatives: ["Export CSV", "Adjust date range"],
        calculationExplanation: "Grouped from metric definitions — no fabricated series.",
        requiredData: report.metricIds,
        payload: { report },
      }));
    }

    const dashboard = buildDashboard({ industry, modules, metrics });
    const analyticsModel = {
      industry,
      businessId: businessId ?? null,
      metrics,
      results,
      alerts,
      reports,
      dashboard,
      alertKinds: [
        "overdue_work", "rising_backlog", "sla_breach_risk", "unassigned_work",
        "failed_integrations", "missing_knowledge", "repeated_no_response",
        "approaching_capacity", "unresolved_approvals",
      ],
      permissions: buildRolePermissions(metrics),
      tenantIsolation: {
        scopedByBusinessId: true,
        businessId: businessId ?? null,
        noCrossTenantMetrics: true,
      },
      honesty: {
        fabricatedMetricsForbidden: true,
        fakeZerosForbiddenWhenUnavailable: true,
      },
    };

    return deepFreeze({
      ok: true,
      analyticsModel,
      recommendations,
      businessOsMapping: mapAnalyticsToBusinessOS(analyticsModel),
      dashboard,
      metrics: recommendations.filter((entry) => String(entry.kind).endsWith("_kpi") || entry.kind === "executive_kpi" || entry.kind === "operational_kpi"),
    });
  }

  calculate(definition, evidence, options = {}) {
    return calculateMetric(definition, evidence, options);
  }

  registerMetric(definition) {
    return this.store.upsertMetricDefinition(definition);
  }

  setTarget(metricId, target) {
    return this.store.setTarget(metricId, target);
  }

  saveReport(report) {
    return this.store.saveReport(report);
  }

  listSavedReports() {
    return this.store.listSavedReports();
  }

  snapshotDefinitions() {
    return this.store.snapshot();
  }

  restoreDefinitions(snapshot) {
    return this.store.restore(snapshot);
  }
}

function buildDashboard({ industry, modules, metrics }) {
  const cards = [
    card("health", "Business health", "metric_cards", "metrics", "Shows real counts once you have activity."),
    card("kpis", "KPI cards", "kpi_cards", "metrics", "Targets and calculated KPIs from live evidence."),
    card("attention", "Needs attention", "attention_queue", "attention", "Work and approvals waiting on you."),
    card("work", "Open work", "work_queue", "work", "Human-approved work across the business."),
    card("workforce", "Digital workforce", "digital_workforce", "workforce", "Employees stay grouped here."),
    card("comms", "Communications", "communication_summary", "communications", "Inbox and campaign delivery once connected."),
    card("deadlines", "Upcoming", "calendar_deadlines", "calendar", "Deadlines appear after scheduling setup."),
    card("alerts", "Alerts", "operational_alerts", "alerts", "Threshold alerts from real evidence."),
    card("charts", "Trends", "charts", "analytics", "Trends appear after enough samples exist."),
    card("reports", "Reports", "reports", "analytics", "Saved report definitions — values stay rederived."),
  ];

  if (industry === "property_management" || modules.some((module) => module.moduleId === "properties")) {
    cards.push(card("properties", "Property demand", "subject_summaries", "subjects", "Property interest from trusted imports."));
    cards.push(card("pipeline", "Relationship pipeline", "pipeline", "relationships", "Prospect and owner follow-up."));
  }
  if (industry === "dental") {
    cards.push(card("patients", "Patients", "subject_summaries", "subjects", "Patient records you have added."));
  }
  if (industry === "sports") {
    cards.push(card("teams", "Teams and players", "subject_summaries", "subjects", "Club records on the universal runtime."));
  }
  if (metrics.some((entry) => entry.category === "readiness" || entry.category === "integration")) {
    cards.push(card("readiness", "Readiness", "readiness", "readiness", "Setup and integration readiness."));
  }

  return createExecutiveDashboardDefinition({
    dashboardId: "executive_home",
    label: "Home",
    cards: cards.filter((entry) => isRegisteredDashboardComponent(entry.componentType)),
  });
}

function card(id, title, componentType, dataSource, emptyState) {
  return {
    id,
    title,
    componentType,
    dataSource,
    permissions: [],
    ordering: 0,
    size: "md",
    emptyState,
    drillDownRoute: null,
  };
}

function buildDefaultReports(metrics) {
  return [
    {
      reportId: "ops_weekly",
      label: "Weekly operations",
      description: "Open work, overdue, approvals, and completion rate.",
      metricIds: metrics.filter((entry) => ["open_work_count", "overdue_work_count", "pending_approvals_count", "work_completion_rate"].includes(entry.metricId)).map((entry) => entry.metricId),
      filters: {},
      dateRange: "7d",
      exportable: true,
      roleVisibility: ["OWNER", "MANAGER"],
      scheduled: { cadence: "weekly", delivery: "definition_only" },
    },
    {
      reportId: "readiness_snapshot",
      label: "Readiness snapshot",
      description: "Knowledge and integration health.",
      metricIds: metrics.filter((entry) => ["knowledge_document_count", "integration_health_count", "failed_integrations_count"].includes(entry.metricId)).map((entry) => entry.metricId),
      filters: {},
      dateRange: "current",
      exportable: true,
      roleVisibility: ["OWNER", "MANAGER"],
      scheduled: null,
    },
  ];
}

function categoryKind(category) {
  switch (String(category)) {
    case "executive": return "executive_kpi";
    case "operational": return "operational_kpi";
    case "team": return "team_kpi";
    case "workflow": return "workflow_kpi";
    case "customer": return "customer_kpi";
    case "integration": return "integration_kpi";
    case "readiness": return "readiness_kpi";
    default: return "operational_kpi";
  }
}

function reasonFor(definition) {
  return `Measure ${definition.label} from ${definition.sourceRuntime} so leaders act on real evidence — not vanity numbers.`;
}

function alternativesFor(definition) {
  return listMetricIds()
    .filter((id) => id !== definition.metricId)
    .slice(0, 3)
    .map((id) => getMetricDefinition(id)?.label ?? id);
}

function buildRolePermissions(metrics) {
  return {
    OWNER: { metricIds: metrics.map((entry) => entry.metricId), canExport: true, canEditTargets: true },
    MANAGER: { metricIds: metrics.map((entry) => entry.metricId), canExport: true, canEditTargets: true },
    EMPLOYEE: {
      metricIds: metrics.filter((entry) => entry.permissions.includes("EMPLOYEE")).map((entry) => entry.metricId),
      canExport: false,
      canEditTargets: false,
    },
    VIEWER: {
      metricIds: metrics.filter((entry) => entry.category === "executive").map((entry) => entry.metricId),
      canExport: false,
      canEditTargets: false,
    },
  };
}

export { METRIC_AVAILABILITY };
