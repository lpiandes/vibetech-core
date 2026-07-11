import { isRegisteredModuleComponent } from "./ModuleComponentRegistry.ts";
import { isRegisteredDashboardCard } from "./DashboardCardRegistry.ts";
import { isRegisteredRecordView } from "./RecordViewRegistry.ts";
import { isRegisteredActionComponent } from "./ActionComponentRegistry.ts";

export type ComposeInput = {
  navigation?: Array<{ moduleId: string; label: string }>;
  dashboardCards?: Array<{ id: string; componentType: string; title: string; emptyState?: string }>;
  modules?: Array<{ moduleId: string; label: string; viewType?: string }>;
  actions?: Array<{ id: string; componentType: string; label: string }>;
};

/**
 * Safe UI composer — only registered component types may render.
 */
export function composeBusinessOSUI(input: ComposeInput) {
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
