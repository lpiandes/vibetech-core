/**
 * Pure Analytics workspace projection — no React.
 *
 * @param {{
 *   analyticsModel?: Record<string, any> | null,
 *   businessOsMapping?: Record<string, any> | null,
 *   role?: string,
 * }} [args]
 */
export function composeAnalyticsView({
  analyticsModel = null,
  businessOsMapping = null,
  role = "OWNER",
} = {}) {
  function asArray(value) {
    return Array.isArray(value) ? value : [];
  }

  const model = analyticsModel ?? null;
  const permissions = model?.permissions?.[role] ?? model?.permissions?.OWNER ?? { metricIds: [] };
  const allowed = new Set(permissions.metricIds ?? []);

  const results = asArray(model?.results)
    .filter((entry) => !allowed.size || allowed.has(entry.metricId) || role === "OWNER")
    .map((entry) => ({
      id: String(entry.metricId),
      label: String(entry.label ?? entry.metricId),
      availability: String(entry.availability ?? "unavailable"),
      value: entry.value,
      unit: entry.unit ?? null,
      trend: entry.trend ?? null,
      confidence: entry.confidence ?? 0,
      freshness: entry.freshness ?? null,
      unavailableReason: entry.unavailableReason ?? entry.emptyState ?? null,
      calculation: entry.calculation ?? null,
      drillDown: asArray(entry.drillDownEvidence),
      alert: entry.alert ?? null,
    }));

  const available = results.filter((entry) => entry.availability === "available" || entry.availability === "stale");
  const missing = results.filter((entry) => entry.availability !== "available" && entry.availability !== "stale");

  return {
    hasAnalytics: Boolean(model),
    role,
    kpis: available,
    missing,
    alerts: asArray(model?.alerts).map((alert) => ({
      id: String(alert.alertId),
      label: String(alert.label),
      level: String(alert.level),
      action: String(alert.recommendedAction ?? ""),
    })),
    reports: asArray(model?.reports ?? businessOsMapping?.reportDefinitions).map((report) => ({
      id: String(report.reportId),
      label: String(report.label),
      description: String(report.description ?? ""),
      metricIds: asArray(report.metricIds),
      exportable: Boolean(report.exportable),
    })),
    definitions: asArray(model?.metrics).map((metric) => ({
      id: String(metric.metricId),
      label: String(metric.label),
      category: String(metric.category),
      description: String(metric.description ?? ""),
      sourceRuntime: String(metric.sourceRuntime),
    })),
    dashboard: model?.dashboard ?? businessOsMapping?.dashboardDefinitions?.[0] ?? null,
    honesty: model?.honesty ?? { fabricatedMetricsForbidden: true },
    metrics: [
      { id: "kpis", label: "KPIs", value: available.length },
      { id: "alerts", label: "Alerts", value: asArray(model?.alerts).length },
      { id: "reports", label: "Reports", value: asArray(model?.reports).length },
      { id: "missing", label: "Needs data", value: missing.length },
    ],
  };
}
