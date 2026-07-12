import { getDefaultArchitectChangeCapabilityRegistry } from "./ArchitectChangeCapabilityRegistry.js";
import { DEFAULT_ARCHITECT_CHANGE_CAPABILITIES } from "./defaultLegacyCapabilities.js";
import { HIGH_VALUE_ARCHITECT_CHANGE_CAPABILITIES } from "./defaultHighValueCapabilities.js";

let registered = false;

/**
 * Register universal default capabilities once per process.
 */
export function registerDefaultArchitectChangeCapabilities({
  registry = getDefaultArchitectChangeCapabilityRegistry(),
  replace = false,
} = {}) {
  if (registered && !replace) return registry;
  for (const definition of DEFAULT_ARCHITECT_CHANGE_CAPABILITIES) {
    if (registry.get(definition.capabilityId) && !replace) continue;
    registry.register(definition, { replace, source: "core" });
  }
  for (const definition of HIGH_VALUE_ARCHITECT_CHANGE_CAPABILITIES) {
    if (registry.get(definition.capabilityId) && !replace) continue;
    registry.register(definition, { replace, source: "core" });
  }
  registered = true;
  return registry;
}

export function resetArchitectChangeCapabilityRegistrationForTests(registry) {
  registered = false;
  return registerDefaultArchitectChangeCapabilities({ registry, replace: true });
}
