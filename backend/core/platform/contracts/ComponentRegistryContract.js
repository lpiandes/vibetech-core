import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";
import {
  MODULE_COMPONENT_TYPES,
  isRegisteredModuleComponent,
} from "../../../../frontend/lib/business-os-ui/ModuleComponentRegistry.js";
import {
  DASHBOARD_CARD_TYPES,
  isRegisteredDashboardCard,
} from "../../../../frontend/lib/business-os-ui/DashboardCardRegistry.js";
import {
  RECORD_VIEW_TYPES,
  isRegisteredRecordView,
} from "../../../../frontend/lib/business-os-ui/RecordViewRegistry.js";
import {
  ACTION_COMPONENT_TYPES,
  isRegisteredActionComponent,
} from "../../../../frontend/lib/business-os-ui/ActionComponentRegistry.js";
import {
  listDashboardComponentTypes,
  isRegisteredDashboardComponent,
} from "../../business-os/BusinessOSDashboardComponentRegistry.js";

/**
 * Component Registry contract — everything rendered later must be registered.
 */
export const COMPONENT_REGISTRY_FAMILIES = Object.freeze([
  "module",
  "dashboard_card",
  "record_view",
  "action",
  "business_os_dashboard",
]);

export function listRegisteredComponentCatalog() {
  return deepFreeze({
    contract: "ComponentRegistry/v1",
    families: {
      module: [...MODULE_COMPONENT_TYPES],
      dashboard_card: [...DASHBOARD_CARD_TYPES],
      record_view: [...RECORD_VIEW_TYPES],
      action: [...ACTION_COMPONENT_TYPES],
      business_os_dashboard: listDashboardComponentTypes(),
    },
  });
}

export function isRegisteredComponent(family, type) {
  switch (String(family)) {
    case "module":
      return isRegisteredModuleComponent(type);
    case "dashboard_card":
      return isRegisteredDashboardCard(type);
    case "record_view":
      return isRegisteredRecordView(type);
    case "action":
      return isRegisteredActionComponent(type);
    case "business_os_dashboard":
      return isRegisteredDashboardComponent(type);
    default:
      return false;
  }
}

export function assertRegisteredComponent(family, type) {
  if (!isRegisteredComponent(family, type)) {
    throw new Error(
      `ComponentRegistryContract: unregistered ${family} component "${type}". Arbitrary UI generation is forbidden.`,
    );
  }
  return true;
}

export function validateComponentRegistryContract() {
  const catalog = listRegisteredComponentCatalog();
  const errors = [];
  for (const family of COMPONENT_REGISTRY_FAMILIES) {
    const types = catalog.families[family] ?? [];
    if (!types.length) errors.push(`empty_family:${family}`);
    for (const type of types) {
      if (!isRegisteredComponent(family, type)) {
        errors.push(`unresolvable:${family}:${type}`);
      }
    }
  }
  // Unknown types must be rejected.
  if (isRegisteredComponent("dashboard_card", "evil_custom_widget")) {
    errors.push("unknown_type_accepted");
  }
  return deepFreeze({ ok: errors.length === 0, errors, catalog });
}
