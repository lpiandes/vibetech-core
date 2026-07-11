import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";
import { PLATFORM_LAYERS, assertPlatformLayer, isPlatformLayer } from "./PlatformLayers.js";

/**
 * Extension classification — every addition belongs to exactly one bucket.
 */
export function classifyExtension({
  extensionId,
  layer,
  description = null,
  owner = null,
  relatedContracts = [],
} = {}) {
  assertPlatformLayer(layer);
  if (!extensionId) throw new Error("ExtensionRules: extensionId required.");

  return deepFreeze({
    extensionId: String(extensionId),
    layer: String(layer),
    description: description == null ? null : String(description),
    owner: owner == null ? null : String(owner),
    relatedContracts: Object.freeze([...(relatedContracts ?? [])].map(String)),
    classifiedAt: "constitution",
  });
}

export function validateExclusiveLayerAssignment(extensions = []) {
  const seen = new Map();
  const violations = [];

  for (const entry of extensions) {
    if (!isPlatformLayer(entry.layer)) {
      violations.push({ extensionId: entry.extensionId, reason: "invalid_layer" });
      continue;
    }
    const key = String(entry.extensionId);
    if (seen.has(key) && seen.get(key) !== entry.layer) {
      violations.push({
        extensionId: key,
        reason: "multiple_layers",
        layers: [seen.get(key), entry.layer],
      });
    } else {
      seen.set(key, entry.layer);
    }
  }

  return deepFreeze({
    ok: violations.length === 0,
    violations,
    allowedLayers: PLATFORM_LAYERS,
  });
}

export const FORBIDDEN_EXTENSION_PATTERNS = deepFreeze([
  "industry_specific_core_runtime",
  "arbitrary_jsx_generation",
  "silent_permission_mutation",
  "vendor_locked_platform_primitive",
  "fabricated_metrics",
]);
