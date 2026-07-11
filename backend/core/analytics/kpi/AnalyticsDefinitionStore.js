import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";

/**
 * Restart-safe store for custom metric definitions, targets, saved reports,
 * dashboard selections, and alert preferences.
 * Calculated analytics remain rederived projections — not persisted here.
 */
export class AnalyticsDefinitionStore {
  constructor({ seed = null } = {}) {
    this._state = seed ? structuredClone(seed) : emptyState();
  }

  snapshot() {
    return deepFreeze(structuredClone(this._state));
  }

  /**
   * Restore from a previous snapshot (restart persistence).
   */
  restore(snapshot) {
    this._state = snapshot ? structuredClone(snapshot) : emptyState();
    return this.snapshot();
  }

  upsertMetricDefinition(definition) {
    if (!definition?.metricId) throw new Error("AnalyticsDefinitionStore: metricId required.");
    this._state.metricDefinitions[definition.metricId] = { ...definition };
    return this.getMetricDefinition(definition.metricId);
  }

  getMetricDefinition(metricId) {
    const entry = this._state.metricDefinitions[String(metricId)];
    return entry ? deepFreeze({ ...entry }) : null;
  }

  listMetricDefinitions() {
    return deepFreeze(Object.values(this._state.metricDefinitions).map((entry) => ({ ...entry })));
  }

  setTarget(metricId, target) {
    this._state.targets[String(metricId)] = { metricId: String(metricId), target: Number(target) };
    return deepFreeze({ ...this._state.targets[String(metricId)] });
  }

  getTarget(metricId) {
    const entry = this._state.targets[String(metricId)];
    return entry ? deepFreeze({ ...entry }) : null;
  }

  saveReport(report) {
    if (!report?.reportId) throw new Error("AnalyticsDefinitionStore: reportId required.");
    this._state.savedReports[report.reportId] = { ...report };
    return deepFreeze({ ...this._state.savedReports[report.reportId] });
  }

  listSavedReports() {
    return deepFreeze(Object.values(this._state.savedReports).map((entry) => ({ ...entry })));
  }

  setDashboardSelection(dashboardId, widgetIds) {
    this._state.dashboardSelections[String(dashboardId)] = {
      dashboardId: String(dashboardId),
      widgetIds: Array.isArray(widgetIds) ? widgetIds.map(String) : [],
    };
    return deepFreeze({ ...this._state.dashboardSelections[String(dashboardId)] });
  }

  setAlertPreference(alertKind, enabled) {
    this._state.alertPreferences[String(alertKind)] = Boolean(enabled);
    return deepFreeze({ alertKind: String(alertKind), enabled: Boolean(enabled) });
  }
}

function emptyState() {
  return {
    metricDefinitions: {},
    targets: {},
    savedReports: {},
    dashboardSelections: {},
    alertPreferences: {},
  };
}
