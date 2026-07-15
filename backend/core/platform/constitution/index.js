export {
  PLATFORM_LAYERS,
  PLATFORM_LAYER_DESCRIPTIONS,
  isPlatformLayer,
  assertPlatformLayer,
} from "./PlatformLayers.js";

export {
  classifyExtension,
  validateExclusiveLayerAssignment,
  FORBIDDEN_EXTENSION_PATTERNS,
} from "./ExtensionRules.js";

export {
  BLUEPRINT_RESOLUTION_ORDER,
  resolveReusePreference,
  assertResolutionOrderIntact,
} from "./BlueprintResolutionOrder.js";

export {
  AI_ARCHITECT_LIFECYCLE,
  isArchitectStage,
  validateLifecycleTransition,
  requireGovernedInstallPath,
} from "./AiArchitectLifecycle.js";

/**
 * Persisted BuilderSession stages map to AI_ARCHITECT_LIFECYCLE via
 * backend/core/ai-builder/BuilderSessionLifecycle.js.
 * ArchitectPipeline stages remain intelligence-only (not session state).
 */
