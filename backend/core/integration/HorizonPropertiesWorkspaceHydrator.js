import { configureHorizonPropertiesWorkspace } from "./HorizonPropertiesWorkspaceConfigurator.js";

/**
 * @deprecated Use configureHorizonPropertiesWorkspace + bootstrapHorizonPropertiesDemo.
 * Legitimate starting-state configuration only — no final business outcomes.
 */
export function hydrateHorizonPropertiesWorkspace({ stack, nowISO }) {
  return configureHorizonPropertiesWorkspace({ stack, nowISO });
}
