import { deepFreeze } from "../workspace/_utils/deepFreeze.js";
import { getDefaultBusinessOSCapabilityRegistry } from "../business-os/BusinessOSCapabilityRegistry.js";
import { resolveEmployeeArchetype } from "../business-os/BusinessOSEmployeeArchetypes.js";
import { createCapabilityProposal } from "./BusinessBuilderSession.js";

/**
 * Analyzes requested needs against reusable capabilities.
 * Never silently claims a missing capability is implemented.
 */
export class BusinessCapabilityGapAnalyzer {
  constructor({ capabilityRegistry = getDefaultBusinessOSCapabilityRegistry() } = {}) {
    this.capabilityRegistry = capabilityRegistry;
  }

  analyzeNeeds(needs = []) {
    const resolutions = [];
    const proposals = [];

    for (const need of needs) {
      const requestedOutcome = need.requestedOutcome ?? need.label ?? need.capabilityId ?? "Unknown need";
      const capabilityId = need.capabilityId ?? null;
      const classified = capabilityId
        ? this.capabilityRegistry.classifyRequirement(need)
        : this.capabilityRegistry.classifyRequirement({ capabilityId: slug(requestedOutcome), label: requestedOutcome });

      if (need.archetypeId) {
        const archetype = resolveEmployeeArchetype(need.archetypeId);
        if (!archetype.ok) {
          const proposal = createCapabilityProposal({
            requestedOutcome: `Digital employee: ${requestedOutcome}`,
            evidence: need.evidence ?? [],
            whyExistingCapabilitiesAreInsufficient: archetype.message,
            proposedUniversalCapability: {
              kind: "employee_archetype",
              suggestedArchetype: need.archetypeId,
            },
            safetyRequirements: ["human_approval_for_customer_comms"],
          });
          proposals.push(proposal);
          resolutions.push(deepFreeze({
            requestedOutcome,
            availability: "missing_reusable_capability",
            proposalId: proposal.proposalId,
            honest: true,
          }));
          continue;
        }
      }

      if (classified.proposalRequired || classified.availability === "missing_reusable_capability") {
        const proposal = createCapabilityProposal({
          requestedOutcome,
          evidence: need.evidence ?? [],
          affectedBusinesses: need.affectedBusinesses ?? [],
          whyExistingCapabilitiesAreInsufficient:
            classified.message ?? "No existing reusable capability or safe configuration covers this outcome.",
          proposedUniversalCapability: {
            kind: "platform_capability",
            suggestedCapabilityId: slug(requestedOutcome),
            label: requestedOutcome,
          },
          safetyRequirements: ["reuse_before_build", "no_customer_codegen", "human_approval_default"],
          estimatedDependencies: classified.setupRequirements ?? [],
        });
        proposals.push(proposal);
        resolutions.push(deepFreeze({
          requestedOutcome,
          availability: "missing_reusable_capability",
          proposalId: proposal.proposalId,
          fabricated: false,
          honest: true,
        }));
        continue;
      }

      resolutions.push(deepFreeze({
        requestedOutcome,
        capabilityId: classified.capabilityId,
        availability: classified.availability,
        deferred: Boolean(classified.deferred),
        prohibited: Boolean(classified.prohibited),
        setupRequirements: classified.setupRequirements ?? [],
        fabricated: false,
        honest: true,
      }));
    }

    return deepFreeze({ resolutions, proposals });
  }
}

function slug(value) {
  return String(value ?? "need")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 64);
}
