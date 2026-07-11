import {
  UNIVERSAL_COMPONENT_CATALOG,
  UNIVERSAL_COMPONENT_SUPPORTS,
  UNIVERSAL_COMPONENT_TYPES,
  applyUniversalTerminology,
  canRenderUniversalComponent,
  getUniversalComponentMeta,
  isRegisteredUniversalComponent,
  listUniversalComponentsByCategory,
} from "./catalog.js";

/**
 * Universal Component Registry — resolve only registered types.
 * Never invent components. Never return arbitrary React factories here.
 */

const RESOLVED = new Map(
  UNIVERSAL_COMPONENT_CATALOG.map((entry) => [
    entry.type,
    Object.freeze({
      ...entry,
      family: "universal",
      supports: UNIVERSAL_COMPONENT_SUPPORTS,
      allowed: true,
    }),
  ]),
);

export function resolveUniversalComponent(type) {
  if (!isRegisteredUniversalComponent(type)) return null;
  return RESOLVED.get(String(type)) ?? null;
}

export function listUniversalComponentRegistry() {
  return UNIVERSAL_COMPONENT_CATALOG.map((entry) => resolveUniversalComponent(entry.type));
}

export function assertUniversalComponentRegistered(type) {
  if (!isRegisteredUniversalComponent(type)) {
    throw new Error(
      `UniversalComponentRegistry: unregistered component "${type}". Arbitrary UI generation is forbidden.`,
    );
  }
  return resolveUniversalComponent(type);
}

export function validateUniversalComponentRegistry() {
  const errors = [];
  if (!UNIVERSAL_COMPONENT_TYPES.length) errors.push("empty_catalog");
  for (const type of UNIVERSAL_COMPONENT_TYPES) {
    if (!resolveUniversalComponent(type)) errors.push(`unresolvable:${type}`);
  }
  if (isRegisteredUniversalComponent("evil_custom_widget")) {
    errors.push("unknown_type_accepted");
  }
  if (resolveUniversalComponent("evil_custom_widget")) {
    errors.push("unknown_type_resolved");
  }
  return {
    ok: errors.length === 0,
    errors,
    count: UNIVERSAL_COMPONENT_TYPES.length,
    supports: UNIVERSAL_COMPONENT_SUPPORTS,
  };
}

export {
  UNIVERSAL_COMPONENT_CATALOG,
  UNIVERSAL_COMPONENT_SUPPORTS,
  UNIVERSAL_COMPONENT_TYPES,
  applyUniversalTerminology,
  canRenderUniversalComponent,
  getUniversalComponentMeta,
  isRegisteredUniversalComponent,
  listUniversalComponentsByCategory,
};
