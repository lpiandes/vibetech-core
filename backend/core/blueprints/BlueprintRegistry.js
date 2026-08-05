import { deepFreeze } from "../workspace/_utils/deepFreeze.js";
import { createBlueprintDefinition } from "./BlueprintDefinition.js";
import { resolveBlueprintDependencies } from "./BlueprintDependencyResolver.js";
import { validateBlueprintCompatibility } from "./BlueprintCompatibilityValidator.js";
import { createPropertyManagementGoldBlueprint } from "./PropertyManagementGoldBlueprint.js";
import { createRevenueFollowThroughBlueprint } from "../ai-builder/operating-contract/rft/rftBlueprint.js";
import {
  BLUEPRINT_RESOLUTION_ORDER,
  resolveReusePreference,
} from "../platform/constitution/BlueprintResolutionOrder.js";

/**
 * Multi-source Blueprint Registry.
 * Sources: platform, package, gold, business_override, marketplace, delivery_moat.
 */
export class BlueprintRegistry {
  constructor() {
    this._byId = new Map();
    this._byIndustry = new Map();
    this._businessOverrides = new Map();
  }

  register(blueprint, { replace = false } = {}) {
    if (!blueprint?.blueprintId) {
      throw new Error("BlueprintRegistry: blueprintId required.");
    }
    const id = String(blueprint.blueprintId);
    if (this._byId.has(id) && !replace) {
      throw new Error(`BlueprintRegistry: blueprint already registered: ${id}`);
    }
    if (this._byId.has(id) && this._byId.get(id).goldStatus && !replace) {
      throw new Error(`BlueprintRegistry: gold blueprint is immutable: ${id}`);
    }
    this._byId.set(id, blueprint);
    const industry = String(blueprint.industry);
    if (!this._byIndustry.has(industry)) this._byIndustry.set(industry, new Set());
    this._byIndustry.get(industry).add(id);
    return blueprint;
  }

  get(blueprintId) {
    return this._byId.get(String(blueprintId)) ?? null;
  }

  list({ industry = null, source = null, goldOnly = false } = {}) {
    let entries = [...this._byId.values()];
    if (industry) entries = entries.filter((entry) => entry.industry === industry);
    if (source) entries = entries.filter((entry) => entry.source === source);
    if (goldOnly) entries = entries.filter((entry) => entry.goldStatus);
    return deepFreeze(entries);
  }

  registerBusinessOverride(businessId, blueprint) {
    const key = String(businessId);
    if (!this._businessOverrides.has(key)) this._businessOverrides.set(key, new Map());
    this._businessOverrides.get(key).set(blueprint.blueprintId, blueprint);
    this.register(blueprint, { replace: true });
    return blueprint;
  }

  listBusinessOverrides(businessId) {
    const map = this._businessOverrides.get(String(businessId));
    return deepFreeze(map ? [...map.values()] : []);
  }

  resolveForBusiness({ businessId = null, industry = null, preferGold = true } = {}) {
    const overrides = businessId ? this.listBusinessOverrides(businessId) : [];
    if (overrides.length) return overrides[0];

    const industryBlueprints = industry
      ? this.list({ industry })
      : this.list();
    if (preferGold) {
      const gold = industryBlueprints.find((entry) => entry.goldStatus);
      if (gold) return gold;
    }
    return industryBlueprints[0] ?? null;
  }

  /**
   * Constitution reuse preference — installed → templates → gold → industry → components → archetypes → gap.
   */
  resolveReusePreference(flags = {}) {
    return resolveReusePreference(flags);
  }

  getResolutionOrder() {
    return BLUEPRINT_RESOLUTION_ORDER;
  }

  resolveDependencies(blueprint) {
    return resolveBlueprintDependencies(blueprint, { registry: this });
  }

  validate(blueprint, options = {}) {
    return validateBlueprintCompatibility(blueprint, options);
  }
}

let defaultRegistry = null;

export function createBlueprintRegistry({ includeDefaults = true } = {}) {
  const registry = new BlueprintRegistry();
  if (includeDefaults) {
    registry.register(createPropertyManagementGoldBlueprint());
    registry.register(createBlueprintDefinition({
      blueprintId: "bp_platform_universal_core",
      name: "Universal Core",
      industry: "universal",
      version: 1,
      maturity: "stable",
      source: "platform",
      supportedCapabilities: ["work_queue", "digital_workforce", "approved_knowledge", "readiness_checklist"],
      requiredCapabilities: ["work_queue"],
      moduleRecipe: [
        { moduleId: "home", label: "Home", moduleType: "operations", navigationPriority: 1 },
        { moduleId: "work", label: "Work", moduleType: "operations", navigationPriority: 2 },
        { moduleId: "digital_workforce", label: "Team", moduleType: "workforce", navigationPriority: 50 },
        { moduleId: "knowledge", label: "Knowledge", moduleType: "knowledge", navigationPriority: 60 },
        { moduleId: "settings", label: "Settings", moduleType: "configuration", navigationPriority: 100 },
      ],
      migrationCompatibility: { minSchemaVersion: 1, maxSchemaVersion: 1 },
      acceptanceTests: ["universal_core_modules_present"],
    }));
    registry.register(createRevenueFollowThroughBlueprint());
  }
  return registry;
}

export function getDefaultBlueprintRegistry() {
  if (!defaultRegistry) {
    defaultRegistry = createBlueprintRegistry({ includeDefaults: true });
  }
  return defaultRegistry;
}

export function resetDefaultBlueprintRegistryForTests() {
  defaultRegistry = null;
}
