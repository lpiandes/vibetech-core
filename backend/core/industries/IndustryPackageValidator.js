import { OUTCOME_CREATES_WORK_TEMPLATE } from "../automations/templates/AutomationTemplateRegistry.js";

function fail(message) {
  throw new Error(`IndustryPackageValidator: ${message}`);
}

function isPlainObject(v) {
  return Boolean(v) && typeof v === "object" && !Array.isArray(v);
}

function validateSectionArray(arr, name, { requiredKeys } = {}) {
  if (arr === undefined) return;
  if (!Array.isArray(arr)) fail(`${name} must be array.`);
  for (const item of arr) {
    if (!isPlainObject(item)) fail(`${name} entries must be plain objects.`);
    for (const key of requiredKeys ?? []) {
      if (!(key in item)) fail(`${name} entry missing required key: ${key}`);
    }
  }
}

export function validateIndustryPackage(pkg) {
  if (!pkg || typeof pkg !== "object") fail("package required.");
  if (!Object.isFrozen(pkg)) fail("package must be frozen.");

  if (!pkg.id || typeof pkg.id !== "string") fail("package.id required.");
  if (!pkg.name || typeof pkg.name !== "string") fail("package.name required.");
  if (!pkg.description || typeof pkg.description !== "string") fail("package.description required.");
  if (typeof pkg.version !== "number" || !Number.isFinite(pkg.version)) fail("package.version required number.");

  validateSectionArray(pkg.capabilities, "capabilities", { requiredKeys: ["id", "name", "description", "category"] });
  validateSectionArray(pkg.knowledgeCategories, "knowledgeCategories", { requiredKeys: ["id", "name"] });
  validateSectionArray(pkg.automationConfigurations, "automationConfigurations", { requiredKeys: ["id", "configuration"] });
  validateSectionArray(pkg.requestTypes, "requestTypes", { requiredKeys: ["id", "displayName"] });
  validateSectionArray(pkg.workTypes, "workTypes", { requiredKeys: ["id", "displayName"] });
  validateSectionArray(pkg.interactionOutcomes, "interactionOutcomes", { requiredKeys: ["id"] });
  validateSectionArray(pkg.employeeDefinitions, "employeeDefinitions", { requiredKeys: ["id", "name"] });
  validateSectionArray(pkg.connectedSystemRequirements, "connectedSystemRequirements", { requiredKeys: ["id", "requirementLevel"] });
  validateSectionArray(pkg.connectionGuidance, "connectionGuidance", { requiredKeys: ["id", "displayName", "requirementLevel"] });
  validateSectionArray(pkg.relationshipTypes, "relationshipTypes", { requiredKeys: ["type", "label"] });
  validateSectionArray(pkg.lifecycleTransitions, "lifecycleTransitions", { requiredKeys: ["from", "to"] });
  validateSectionArray(pkg.importProfiles, "importProfiles", { requiredKeys: ["profileId", "sourceSystem"] });

  if (pkg.onboardingSchema !== undefined && !isPlainObject(pkg.onboardingSchema)) {
    fail("onboardingSchema must be plain object.");
  }

  for (const auto of pkg.automationConfigurations ?? []) {
    if (!isPlainObject(auto.configuration)) fail(`automationConfigurations[${auto.id}].configuration required.`);
  }

  return { ok: true };
}

export function validateIndustryPackageConfiguration(configuration) {
  if (configuration !== undefined && !isPlainObject(configuration)) {
    fail("configuration must be plain object.");
  }
  return { ok: true };
}
