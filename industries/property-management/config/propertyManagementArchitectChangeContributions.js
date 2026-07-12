/**
 * Property Management package contribution to Architect change capabilities.
 * Terminology and examples live here — not in universal Architect core.
 */
import { contributeArchitectChangeCapabilities } from "../../../backend/core/ai-builder/change-capabilities/packageContribution.js";
import { registerDefaultArchitectChangeCapabilities } from "../../../backend/core/ai-builder/change-capabilities/registerDefaultArchitectChangeCapabilities.js";

export function registerPropertyManagementArchitectChangeContributions(registry) {
  registerDefaultArchitectChangeCapabilities({ registry });
  return contributeArchitectChangeCapabilities({
    source: "package:property_management",
    registry,
    vocabulary: [
      {
        capabilityId: "architect.change.add_employee",
        synonyms: ["leasing agent", "property manager", "maintenance tech"],
        examples: [
          "We hired another leasing agent",
          "Add a maintenance tech AI employee",
        ],
      },
      {
        capabilityId: "architect.change.add_location",
        synonyms: ["community", "property office"],
        examples: ["Add a new community office in Austin"],
      },
    ],
    capabilities: [],
  });
}
