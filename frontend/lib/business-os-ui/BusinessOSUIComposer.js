import { isRegisteredModuleComponent } from "./ModuleComponentRegistry.js";
import { isRegisteredDashboardCard } from "./DashboardCardRegistry.js";
import { isRegisteredRecordView } from "./RecordViewRegistry.js";
import { isRegisteredActionComponent } from "./ActionComponentRegistry.js";

/**
 * Safe UI composer — only registered component types may render.
 */
export function composeBusinessOSUI(input = {}) {
  const dashboardCards = (input.dashboardCards ?? []).filter((card) =>
    isRegisteredDashboardCard(card.componentType),
  );
  const modules = (input.modules ?? []).map((module) => ({
    ...module,
    viewType: isRegisteredModuleComponent(module.viewType ?? "records_list")
      ? (module.viewType ?? "records_list")
      : "records_list",
  }));
  const actions = (input.actions ?? []).filter((action) =>
    isRegisteredActionComponent(action.componentType),
  );
  const recordViews = ["summary", "timeline", "related_work"].filter(isRegisteredRecordView);

  return {
    navigation: input.navigation ?? [],
    dashboardCards,
    modules,
    actions,
    recordViews,
    rejected: {
      dashboardCards: (input.dashboardCards ?? [])
        .filter((card) => !isRegisteredDashboardCard(card.componentType))
        .map((card) => card.componentType),
      actions: (input.actions ?? [])
        .filter((action) => !isRegisteredActionComponent(action.componentType))
        .map((action) => action.componentType),
    },
  };
}
