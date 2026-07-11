import { deepFreeze } from "../workspace/_utils/deepFreeze.js";
import { buildBusinessOSNavigation } from "../business-os/BusinessOSNavigationBuilder.js";
import { resolveRoleAccess } from "../business-os/BusinessOSRoleAccess.js";
import { DashboardRecommendationEngine } from "./DashboardRecommendationEngine.js";
import { composeBusinessOSUI } from "../../../frontend/lib/business-os-ui/BusinessOSUIComposer.js";
import { humanizeStatus } from "./BuilderUxPresentation.js";

/**
 * Safe live portal preview — registered UI components only, role-filtered.
 */
export function buildBuilderPortalPreview({
  specification,
  businessId = "preview",
  membershipRole = "OWNER",
  appearance = {},
  navigationOverrides = null,
} = {}) {
  if (!specification) {
    return deepFreeze({ ok: false, reason: "specification_required" });
  }

  const roleAccess = resolveRoleAccess({
    specification,
    membershipRole,
  });

  const modules = (specification.modules ?? [])
    .filter((module) => roleAccess.visibleModuleIds.includes(module.moduleId))
    .map((module) => {
      const override = navigationOverrides?.labels?.[module.moduleId];
      const hidden = Boolean(navigationOverrides?.hidden?.[module.moduleId]);
      return {
        moduleId: module.moduleId,
        label: override ?? module.label,
        hidden,
        viewType: "records_list",
      };
    })
    .filter((module) => !module.hidden);

  const navigation = buildBusinessOSNavigation({
    modules: modules.map((module) => ({
      moduleId: module.moduleId,
      label: module.label,
      navigationGroup: "primary",
    })),
    navigation: {
      ...(specification.navigation ?? {}),
      primaryItems: navigationOverrides?.order?.length
        ? navigationOverrides.order
          .map((moduleId) => modules.find((module) => module.moduleId === moduleId))
          .filter(Boolean)
          .map((module) => ({ moduleId: module.moduleId, label: module.label }))
        : [],
      maximumPrimaryItems: 7,
    },
    businessId,
  });

  const dashboard = new DashboardRecommendationEngine().recommend({
    businessSummary: specification.businessProfile,
    modules: specification.modules,
  }).dashboard;

  const composed = composeBusinessOSUI({
    navigation: navigation.primaryItems
      .filter((item) => item.moduleId !== "more")
      .map((item) => ({ moduleId: item.moduleId, label: item.label })),
    dashboardCards: dashboard.cards.map((card) => ({
      id: card.id,
      componentType: card.componentType,
      title: card.title,
      emptyState: card.emptyState,
    })),
    modules,
    actions: [
      { id: "ask", componentType: "primary_button", label: "Ask VIBETech" },
      { id: "work", componentType: "open_work", label: "Open Work" },
    ],
  });

  const employees = (specification.employeeDefinitions ?? []).map((employee) => ({
    name: employee.label,
    role: humanizeStatus(employee.archetypeId ?? "digital employee"),
    purpose: employee.purpose,
    responsibilities: employee.responsibilities ?? employee.duties ?? [],
    permittedActions: (employee.permittedCapabilities ?? employee.capabilities ?? [])
      .map(humanizeStatus),
    approvalRequirements: (employee.approvalRequirements ?? []).map(humanizeStatus),
    knowledgeNeeded: (employee.requiredKnowledge ?? []).map(humanizeStatus),
    integrationsNeeded: (employee.requiredIntegrations ?? []).map(humanizeStatus),
    readiness: humanizeStatus(employee.readinessState ?? "needs setup"),
    escalation: employee.escalationRules ?? employee.escalation ?? "Escalate to the owner when unsure.",
  }));

  return deepFreeze({
    ok: true,
    role: membershipRole,
    roleLabel: roleAccess.roleLabel ?? humanizeStatus(membershipRole),
    appearance: {
      accentColor: appearance.accentColor ?? "#0F766E",
      businessName: appearance.businessName
        ?? specification.businessProfile?.businessName
        ?? "Your business",
      logoUrl: appearance.logoUrl ?? null,
    },
    sidebar: {
      primary: composed.navigation,
      overflow: navigation.overflowItems.map((item) => item.label),
      digitalWorkforceGrouped: true,
    },
    dashboard: {
      cards: composed.dashboardCards,
      rejected: composed.rejected.dashboardCards,
    },
    modules: composed.modules,
    digitalWorkforce: employees,
    canRequestAccess: roleAccess.canRequestAccess,
    safe: composed.rejected.dashboardCards.length === 0 && composed.rejected.actions.length === 0,
  });
}
