import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";
import { isRegisteredDashboardComponent } from "../../business-os/BusinessOSDashboardComponentRegistry.js";

/**
 * Map analytics model → existing Business OS dashboard / report fields.
 * Does not invent a parallel schema. Only registered widget types.
 */
export function mapAnalyticsToBusinessOS(analyticsModel = {}) {
  const metrics = analyticsModel.metrics ?? [];
  const widgets = [];

  widgets.push({
    id: "health",
    title: "Business health",
    componentType: "metric_cards",
    dataSource: "metrics",
    emptyState: "Health KPIs appear once operating evidence exists.",
  });
  widgets.push({
    id: "kpis",
    title: "KPI cards",
    componentType: "kpi_cards",
    dataSource: "metrics",
    emptyState: "KPI cards appear once targets and evidence exist.",
  });
  widgets.push({
    id: "alerts",
    title: "Operational alerts",
    componentType: "operational_alerts",
    dataSource: "alerts",
    emptyState: "Alerts appear when thresholds or overdue Work are detected.",
  });
  widgets.push({
    id: "work",
    title: "Open work",
    componentType: "work_queue",
    dataSource: "work",
    emptyState: "Work appears after the first Work item is created.",
  });
  if (metrics.some((entry) => entry.category === "integration")) {
    widgets.push({
      id: "readiness",
      title: "Readiness",
      componentType: "readiness",
      dataSource: "readiness",
      emptyState: "Readiness reflects integrations and knowledge setup.",
    });
  }
  widgets.push({
    id: "charts",
    title: "Trends",
    componentType: "charts",
    dataSource: "analytics",
    emptyState: "Trends appear after enough samples exist.",
  });
  if ((analyticsModel.reports ?? []).length) {
    widgets.push({
      id: "reports",
      title: "Reports",
      componentType: "reports",
      dataSource: "analytics",
      emptyState: "Saved reports appear once definitions exist.",
    });
  }

  const dashboardDefinitions = [
    {
      dashboardId: analyticsModel.dashboard?.dashboardId ?? "executive_home",
      label: analyticsModel.dashboard?.label ?? "Home",
      audience: "owner",
      widgets: widgets.filter((widget) => isRegisteredDashboardComponent(widget.componentType)),
      roleVisibility: {
        OWNER: widgets.map((widget) => widget.id),
        MANAGER: widgets.map((widget) => widget.id),
        EMPLOYEE: widgets.filter((widget) => widget.id === "work" || widget.id === "health").map((widget) => widget.id),
        VIEWER: ["health"],
      },
    },
  ];

  const reportDefinitions = (analyticsModel.reports ?? []).map((report) => ({
    reportId: report.reportId,
    label: report.label,
    metricIds: report.metricIds,
    filters: report.filters ?? {},
    dateRange: report.dateRange ?? "7d",
    exportable: Boolean(report.exportable),
    roleVisibility: report.roleVisibility ?? ["OWNER", "MANAGER"],
    description: report.description ?? "",
  }));

  return deepFreeze({
    dashboardDefinitions,
    reportDefinitions,
    metricDefinitions: metrics.map((metric) => ({
      metricId: metric.metricId,
      label: metric.label,
      category: metric.category,
      sourceRuntime: metric.sourceRuntime,
    })),
    alertDefinitions: (analyticsModel.alertKinds ?? []).map((kind) => ({ alertKind: kind })),
    tenantIsolation: {
      scopedByBusinessId: true,
      businessId: analyticsModel.businessId ?? null,
      noCrossTenantMetrics: true,
    },
  });
}
