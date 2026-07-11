import { deepFreeze } from "../workspace/_utils/deepFreeze.js";
import { isRegisteredDashboardComponent } from "../business-os/BusinessOSDashboardComponentRegistry.js";
import { AnalyticsEngine } from "../analytics/kpi/AnalyticsEngine.js";

export function createExecutiveDashboardDefinition({
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
 * Thin facade — preserves builder API while delegating to AnalyticsEngine.
 * Never fabricates metrics; only registered dashboard components.
 */
export class DashboardRecommendationEngine {
  constructor({ analyticsEngine = new AnalyticsEngine() } = {}) {
    this.analyticsEngine = analyticsEngine;
  }

  recommend({ businessSummary = {}, modules = [], dna = null, evidence = {}, businessId = null } = {}) {
    const result = this.analyticsEngine.recommendAnalytics({
      businessSummary,
      modules,
      dna,
      evidence,
      businessId,
    });

    const dashboard = result.dashboard;
    const filtered = createExecutiveDashboardDefinition({
      dashboardId: dashboard.dashboardId,
      label: dashboard.label,
      audience: dashboard.audience,
      cards: (dashboard.cards ?? []).filter((entry) => isRegisteredDashboardComponent(entry.componentType)),
    });

    return deepFreeze({
      ok: true,
      dashboard: filtered,
      analyticsModel: result.analyticsModel,
      businessOsMapping: result.businessOsMapping,
      recommendations: result.recommendations,
      gaps: [],
    });
  }
}

export function bindDashboardProjection(card, { dataAvailable = false } = {}) {
  return deepFreeze({
    ...card,
    projectionId: card.dataSource,
    emptyState: dataAvailable ? null : card.emptyState,
    fabricatedMetricsForbidden: true,
  });
}

export function validateDashboardDefinition(definition) {
  const errors = [];
  for (const card of definition.cards ?? []) {
    if (!isRegisteredDashboardComponent(card.componentType)) {
      errors.push({ code: "unknown_component", message: card.componentType });
    }
    if (!card.dataSource && !card.projectionId) {
      errors.push({ code: "missing_projection", message: card.id });
    }
  }
  return deepFreeze({ ok: errors.length === 0, errors });
}
