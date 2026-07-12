import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";
import { createArchitectChangeCapabilityDefinition } from "./ArchitectChangeCapabilityDefinition.js";
import { matchArchitectChangeRequest } from "./matchArchitectChangeRequest.js";

/**
 * In-process registry for declarative Architect change capabilities.
 * Packages/blueprints register additional definitions without editing core orchestrators.
 */
export class ArchitectChangeCapabilityRegistry {
  constructor() {
    this._byId = new Map();
    this._byLegacyKind = new Map();
  }

  register(definitionInput, { replace = false, source = "core" } = {}) {
    const definition = createArchitectChangeCapabilityDefinition(definitionInput);
    const id = definition.capabilityId;
    if (this._byId.has(id) && !replace) {
      throw new Error(`ArchitectChangeCapabilityRegistry: duplicate capabilityId: ${id}`);
    }
    this._byId.set(id, deepFreeze({ ...definition, _source: String(source) }));
    for (const alias of definition.legacyKindAliases) {
      this._byLegacyKind.set(alias, id);
    }
    return this._byId.get(id);
  }

  get(capabilityId) {
    return this._byId.get(String(capabilityId)) ?? null;
  }

  resolveLegacyKind(kind) {
    const id = this._byLegacyKind.get(String(kind));
    return id ? this.get(id) : null;
  }

  list({ enabledOnly = true, blueprintId = null, industryPackageId = null } = {}) {
    let entries = [...this._byId.values()];
    if (enabledOnly) {
      entries = entries.filter((entry) => entry.packageAvailability.defaultEnabled);
    }
    if (blueprintId) {
      entries = entries.filter((entry) => (
        entry.packageAvailability.blueprintIds.length === 0
        || entry.packageAvailability.blueprintIds.includes(String(blueprintId))
      ));
    }
    if (industryPackageId) {
      entries = entries.filter((entry) => (
        entry.packageAvailability.industryPackageIds.length === 0
        || entry.packageAvailability.industryPackageIds.includes(String(industryPackageId))
      ));
    }
    return deepFreeze(entries);
  }

  match(text, context = {}) {
    return matchArchitectChangeRequest({
      text,
      capabilities: this.list({
        blueprintId: context.blueprintId ?? null,
        industryPackageId: context.industryPackageId ?? null,
      }),
      context,
    });
  }

  assertRegistered(capabilityId) {
    const found = this.get(capabilityId);
    if (!found) throw new Error(`ArchitectChangeCapabilityRegistry: unknown capability: ${capabilityId}`);
    return found;
  }
}

let defaultRegistry = null;

export function getDefaultArchitectChangeCapabilityRegistry() {
  if (!defaultRegistry) {
    defaultRegistry = new ArchitectChangeCapabilityRegistry();
  }
  return defaultRegistry;
}

export function resetDefaultArchitectChangeCapabilityRegistryForTests() {
  defaultRegistry = new ArchitectChangeCapabilityRegistry();
  return defaultRegistry;
}
