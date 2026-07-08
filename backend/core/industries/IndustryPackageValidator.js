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

function validateRelationshipFollowUpRules(rules) {
  if (rules === undefined) return;
  validateSectionArray(rules, "relationshipFollowUpRules", {
    requiredKeys: ["id", "relationshipTypes", "priority", "reasonCode", "reasonLabel", "targetWork", "recurrenceDays"],
  });
  for (const rule of rules) {
    if (!Array.isArray(rule.relationshipTypes) || rule.relationshipTypes.length === 0) {
      fail(`relationshipFollowUpRules[${rule.id}].relationshipTypes must be non-empty array.`);
    }
    if (!isPlainObject(rule.targetWork)) {
      fail(`relationshipFollowUpRules[${rule.id}].targetWork must be plain object.`);
    }
    if (!rule.targetWork.workType || typeof rule.targetWork.workType !== "string") {
      fail(`relationshipFollowUpRules[${rule.id}].targetWork.workType required string.`);
    }
    if (!Number.isFinite(Number(rule.recurrenceDays))) {
      fail(`relationshipFollowUpRules[${rule.id}].recurrenceDays required number.`);
    }
    if (rule.conditions !== undefined && !isPlainObject(rule.conditions)) {
      fail(`relationshipFollowUpRules[${rule.id}].conditions must be plain object.`);
    }
  }
}

function validateRelationshipFollowUpOutcomes(outcomes) {
  if (outcomes === undefined) return;
  validateSectionArray(outcomes, "relationshipFollowUpOutcomes", {
    requiredKeys: ["id", "displayName", "applicableRelationshipTypes", "activitySemantics"],
  });
  for (const outcome of outcomes) {
    if (!Array.isArray(outcome.applicableRelationshipTypes) || outcome.applicableRelationshipTypes.length === 0) {
      fail(`relationshipFollowUpOutcomes[${outcome.id}].applicableRelationshipTypes must be non-empty array.`);
    }
    if (!isPlainObject(outcome.activitySemantics)) {
      fail(`relationshipFollowUpOutcomes[${outcome.id}].activitySemantics must be plain object.`);
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
  validateRelationshipFollowUpRules(pkg.relationshipFollowUpRules);
  validateRelationshipFollowUpOutcomes(pkg.relationshipFollowUpOutcomes);
  validateSectionArray(pkg.relationshipFollowUpDraftAssistance, "relationshipFollowUpDraftAssistance", { requiredKeys: ["id", "relationshipTypes", "channel", "subjectTemplate", "bodyTemplate"] });
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
