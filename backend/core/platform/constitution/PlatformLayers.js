import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";

/**
 * Permanent platform layers. Every extension must map to exactly one.
 */
export const PLATFORM_LAYERS = Object.freeze([
  "platform",
  "blueprint",
  "configuration",
  "renderer",
  "gap",
]);

export const PLATFORM_LAYER_DESCRIPTIONS = deepFreeze({
  platform: "Universal primitives shared by every business (Work, Knowledge, governance).",
  blueprint: "Reusable industry or gold recipes — not customer-specific state.",
  configuration: "Customer-installed Business OS choices and appearance.",
  renderer: "Registered presentation components and projections only.",
  gap: "Honest unsupported or deferred capability records.",
});

export function isPlatformLayer(layer) {
  return PLATFORM_LAYERS.includes(String(layer));
}

export function assertPlatformLayer(layer) {
  if (!isPlatformLayer(layer)) {
    throw new Error(`PlatformLayers: invalid layer "${layer}". Must be one of: ${PLATFORM_LAYERS.join(", ")}`);
  }
  return String(layer);
}
