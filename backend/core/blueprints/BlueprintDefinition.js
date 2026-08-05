import { deepFreeze } from "../workspace/_utils/deepFreeze.js";

function fail(message) {
  throw new Error(`BlueprintDefinition: ${message}`);
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function freezeObject(value, fallback = {}) {
  return deepFreeze(value && typeof value === "object" && !Array.isArray(value) ? { ...value } : { ...fallback });
}

function freezeArray(value) {
  return deepFreeze(asArray(value).map((entry) => (
    entry && typeof entry === "object" ? deepFreeze({ ...entry }) : entry
  )));
}

export const BLUEPRINT_MATURITY = Object.freeze([
  "experimental",
  "stable",
  "gold",
]);

export const BLUEPRINT_SOURCES = Object.freeze([
  "platform",
  "package",
  "gold",
  "business_override",
  "marketplace",
  "delivery_moat",
]);

/**
 * Reusable Business OS Blueprint — declarative recipe, not generated source.
 */
export function createBlueprintDefinition({
  blueprintId,
  name,
  industry,
  version = 1,
  maturity = "stable",
  goldStatus = false,
  source = "platform",
  supportedCapabilities = [],
  requiredCapabilities = [],
  optionalCapabilities = [],
  defaultTerminology = {},
  moduleRecipe = [],
  navigationRecipe = {},
  dashboardRecipe = [],
  subjectDefinitions = [],
  relationshipDefinitions = [],
  workRecipes = [],
  employeeRecipes = [],
  campaignRecipes = [],
  knowledgeRequirements = [],
  integrationRequirements = [],
  roleRecipes = [],
  permissionRecipes = [],
  accessRequestPolicies = [],
  readinessChecks = [],
  migrationCompatibility = {},
  acceptanceTests = [],
  packageId = null,
  clientTemplateId = null,
  dependencies = [],
  metadata = {},
} = {}) {
  if (!blueprintId || typeof blueprintId !== "string") fail("blueprintId required string.");
  if (!name || typeof name !== "string") fail("name required string.");
  if (!industry || typeof industry !== "string") fail("industry required string.");
  if (!BLUEPRINT_MATURITY.includes(String(maturity))) fail(`unsupported maturity: ${maturity}`);
  if (!BLUEPRINT_SOURCES.includes(String(source))) fail(`unsupported source: ${source}`);

  const gold = Boolean(goldStatus) || maturity === "gold";

  return deepFreeze({
    blueprintId: String(blueprintId),
    name: String(name),
    industry: String(industry),
    version: Number(version ?? 1),
    maturity: gold ? "gold" : String(maturity),
    goldStatus: gold,
    source: String(source),
    supportedCapabilities: freezeArray(supportedCapabilities),
    requiredCapabilities: freezeArray(requiredCapabilities),
    optionalCapabilities: freezeArray(optionalCapabilities),
    defaultTerminology: freezeObject(defaultTerminology),
    moduleRecipe: freezeArray(moduleRecipe),
    navigationRecipe: freezeObject(navigationRecipe),
    dashboardRecipe: freezeArray(dashboardRecipe),
    subjectDefinitions: freezeArray(subjectDefinitions),
    relationshipDefinitions: freezeArray(relationshipDefinitions),
    workRecipes: freezeArray(workRecipes),
    employeeRecipes: freezeArray(employeeRecipes),
    campaignRecipes: freezeArray(campaignRecipes),
    knowledgeRequirements: freezeArray(knowledgeRequirements),
    integrationRequirements: freezeArray(integrationRequirements),
    roleRecipes: freezeArray(roleRecipes),
    permissionRecipes: freezeArray(permissionRecipes),
    accessRequestPolicies: freezeArray(accessRequestPolicies),
    readinessChecks: freezeArray(readinessChecks),
    migrationCompatibility: freezeObject(migrationCompatibility),
    acceptanceTests: freezeArray(acceptanceTests),
    packageId: packageId == null ? null : String(packageId),
    clientTemplateId: clientTemplateId == null ? null : String(clientTemplateId),
    dependencies: freezeArray(dependencies),
    metadata: freezeObject(metadata),
  });
}

/**
 * Apply business overrides onto a blueprint without mutating the gold original.
 */
export function applyBlueprintOverrides(blueprint, overrides = {}) {
  if (!blueprint) fail("blueprint required.");
  if (blueprint.goldStatus && overrides.mutateGold === true) {
    fail("Gold blueprints are immutable.");
  }

  const merged = createBlueprintDefinition({
    ...blueprint,
    ...overrides,
    blueprintId: overrides.blueprintId ?? `${blueprint.blueprintId}_override`,
    source: "business_override",
    goldStatus: false,
    maturity: "stable",
    moduleRecipe: overrides.moduleRecipe ?? blueprint.moduleRecipe,
    navigationRecipe: {
      ...blueprint.navigationRecipe,
      ...(overrides.navigationRecipe ?? {}),
    },
    defaultTerminology: {
      ...blueprint.defaultTerminology,
      ...(overrides.defaultTerminology ?? {}),
    },
    roleRecipes: overrides.roleRecipes ?? blueprint.roleRecipes,
    permissionRecipes: overrides.permissionRecipes ?? blueprint.permissionRecipes,
    metadata: {
      ...blueprint.metadata,
      ...(overrides.metadata ?? {}),
      overriddenFrom: blueprint.blueprintId,
      goldSourcePreserved: blueprint.goldStatus === true,
    },
  });

  return merged;
}
