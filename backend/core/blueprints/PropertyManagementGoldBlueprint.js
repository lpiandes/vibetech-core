import { createBlueprintDefinition } from "./BlueprintDefinition.js";
import { exportMcBrideBusinessOSSpecification } from "../business-os/McBrideBusinessOSAdapter.js";
import { PROPERTY_MANAGEMENT_PACKAGE } from "../../../industries/property-management/PropertyManagementPackage.js";
import { MCBRIDE_MAGNA_MARE_CLIENT_TEMPLATE } from "../../../industries/property-management/config/mcbrideClientTemplate.js";

/**
 * Property Management Gold Blueprint adapter.
 * References existing McBride / PM package assets — does not duplicate configuration.
 */
export function createPropertyManagementGoldBlueprint({
  industryPackage = PROPERTY_MANAGEMENT_PACKAGE,
  template = MCBRIDE_MAGNA_MARE_CLIENT_TEMPLATE,
} = {}) {
  const mcbrideSpec = exportMcBrideBusinessOSSpecification({
    businessId: null,
    template,
    industryPackage,
  });

  return createBlueprintDefinition({
    blueprintId: "bp_gold_property_management_mcbride",
    name: "Property Management Gold (McBride Reference)",
    industry: "property_management",
    version: 1,
    maturity: "gold",
    goldStatus: true,
    source: "gold",
    packageId: industryPackage.id,
    clientTemplateId: template.id,
    supportedCapabilities: mcbrideSpec.capabilityRequirements.map((entry) => entry.capabilityId),
    requiredCapabilities: mcbrideSpec.capabilityRequirements
      .filter((entry) => entry.source !== "deferred")
      .map((entry) => entry.capabilityId),
    optionalCapabilities: mcbrideSpec.capabilityRequirements
      .filter((entry) => entry.source === "deferred")
      .map((entry) => entry.capabilityId),
    defaultTerminology: mcbrideSpec.terminology,
    moduleRecipe: mcbrideSpec.modules,
    navigationRecipe: mcbrideSpec.navigation,
    dashboardRecipe: mcbrideSpec.dashboardDefinitions,
    subjectDefinitions: mcbrideSpec.subjectDefinitions,
    relationshipDefinitions: mcbrideSpec.relationshipDefinitions,
    workRecipes: mcbrideSpec.workDefinitions,
    employeeRecipes: mcbrideSpec.employeeDefinitions,
    campaignRecipes: mcbrideSpec.campaignDefinitions,
    knowledgeRequirements: mcbrideSpec.knowledgeRequirements,
    integrationRequirements: mcbrideSpec.integrationRequirements,
    roleRecipes: [
      {
        roleId: "owner",
        label: "Owner",
        membershipRole: "OWNER",
        moduleVisibility: mcbrideSpec.modules.map((module) => module.moduleId),
        permissions: ["*"],
      },
      {
        roleId: "manager",
        label: "Manager",
        membershipRole: "MANAGER",
        moduleVisibility: ["home", "work", "people", "properties", "inbox", "knowledge", "performance"],
        permissions: ["work.view", "work.manage", "people.view", "inbox.view", "inbox.manage", "performance.view"],
      },
      {
        roleId: "maintenance_technician",
        label: "Maintenance Technician",
        membershipRole: "EMPLOYEE",
        moduleVisibility: ["home", "work", "properties", "inbox"],
        permissions: ["work.view", "people.view", "inbox.view"],
        deniedModules: ["campaigns", "performance", "integrations", "settings"],
        deniedPermissions: ["performance.view", "integrations.manage", "settings.manage", "business.manage"],
      },
      {
        roleId: "marketing_manager",
        label: "Marketing Manager",
        membershipRole: "MANAGER",
        moduleVisibility: ["home", "work", "people", "campaigns", "inbox", "knowledge", "performance"],
        permissions: ["work.view", "people.view", "inbox.view", "inbox.manage", "performance.view", "knowledge.manage"],
        deniedModules: ["settings"],
        deniedPermissions: ["business.manage", "settings.manage"],
      },
    ],
    permissionRecipes: mcbrideSpec.permissions,
    accessRequestPolicies: [
      {
        policyId: "module_access_request",
        label: "Request module access",
        requestKinds: ["module_access", "action_permission", "role_upgrade", "record_scope", "temporary_access"],
        requiresApproval: true,
        autoApprove: false,
        approverRoles: ["OWNER", "ADMIN"],
      },
    ],
    readinessChecks: mcbrideSpec.readinessRequirements,
    migrationCompatibility: {
      minSchemaVersion: 1,
      maxSchemaVersion: 1,
      packageId: industryPackage.id,
      clientTemplateId: template.id,
    },
    acceptanceTests: [
      "mcbride_modules_present",
      "mcbride_campaigns_present",
      "mcbride_employees_grouped_under_team",
      "no_property_runtime",
      "gold_immutable",
    ],
    dependencies: ["bp_platform_universal_core"],
    metadata: {
      goldBlueprint: true,
      referencesExistingAssets: true,
      mcbrideSpecificationId: mcbrideSpec.specificationId,
      mcbrideContentHash: mcbrideSpec.contentHash,
      doesNotDuplicateMcBrideConfig: true,
    },
  });
}

/**
 * Materialize a BusinessOSSpecification from the gold blueprint + optional overrides.
 * Does not mutate McBride live installation.
 */
export function materializeSpecificationFromGoldBlueprint({
  blueprint = null,
  businessId = null,
  overrides = {},
} = {}) {
  const gold = blueprint ?? createPropertyManagementGoldBlueprint();
  return exportMcBrideBusinessOSSpecification({
    businessId,
    ...(overrides.template ? { template: overrides.template } : {}),
  });
}
