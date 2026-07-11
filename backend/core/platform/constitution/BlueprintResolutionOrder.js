import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";

/**
 * Canonical Blueprint / capability reuse order.
 * Prefer existing reusable assets before proposing gaps.
 */
export const BLUEPRINT_RESOLUTION_ORDER = Object.freeze([
  "installed_configuration",
  "business_templates",
  "gold_blueprints",
  "industry_blueprints",
  "reusable_components",
  "employee_archetypes",
  "platform_gap",
]);

export function resolveReusePreference({
  hasInstalledConfiguration = false,
  hasBusinessTemplate = false,
  hasGoldBlueprint = false,
  hasIndustryBlueprint = false,
  hasReusableComponent = false,
  hasEmployeeArchetype = false,
} = {}) {
  const matches = [];
  if (hasInstalledConfiguration) matches.push("installed_configuration");
  if (hasBusinessTemplate) matches.push("business_templates");
  if (hasGoldBlueprint) matches.push("gold_blueprints");
  if (hasIndustryBlueprint) matches.push("industry_blueprints");
  if (hasReusableComponent) matches.push("reusable_components");
  if (hasEmployeeArchetype) matches.push("employee_archetypes");

  const selected = matches[0] ?? "platform_gap";
  return deepFreeze({
    order: BLUEPRINT_RESOLUTION_ORDER,
    selected,
    rank: BLUEPRINT_RESOLUTION_ORDER.indexOf(selected),
    isGap: selected === "platform_gap",
    explanation: selected === "platform_gap"
      ? "No reusable asset matched — record a platform gap; do not invent custom code."
      : `Prefer ${selected.replace(/_/g, " ")} before lower-ranked sources.`,
  });
}

export function assertResolutionOrderIntact(order = BLUEPRINT_RESOLUTION_ORDER) {
  const expected = [...BLUEPRINT_RESOLUTION_ORDER];
  const actual = [...order];
  const ok = expected.length === actual.length
    && expected.every((entry, index) => entry === actual[index]);
  if (!ok) {
    throw new Error("BlueprintResolutionOrder: resolution order mutated — constitution violation.");
  }
  return true;
}
