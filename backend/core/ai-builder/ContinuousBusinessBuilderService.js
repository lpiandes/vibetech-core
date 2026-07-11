import { deepFreeze } from "../workspace/_utils/deepFreeze.js";
import { AiBuilderService } from "./AiBuilderService.js";
import { withBuilderSessionPatch } from "./BuilderSession.js";

/**
 * Continuous improvement: load installed OS and propose next version.
 */
export class ContinuousBusinessBuilderService {
  constructor({ aiBuilder = new AiBuilderService() } = {}) {
    this.aiBuilder = aiBuilder;
  }

  async startImprovement({
    businessId,
    actorId = null,
    installedSpecification,
    prompt = "Improve this business",
  }) {
    if (!businessId) throw new Error("ContinuousBusinessBuilderService: businessId required.");
    if (!installedSpecification) {
      return deepFreeze({
        ok: false,
        reason: "installed_specification_required",
        message: "Install a Business OS before requesting improvements.",
      });
    }

    const started = await this.aiBuilder.startSession({
      mode: "expand_existing_business",
      businessId,
      actorId,
      businessName: installedSpecification.businessProfile?.businessName ?? null,
      description: prompt,
    });

    // Seed proposal cache with current installed specification as baseline.
    this.aiBuilder.proposals.set(started.session.sessionId, {
      specification: installedSpecification,
      assemblyPlan: { selectedBlueprints: [], selectedComponents: [], capabilityGaps: [] },
      proposal: null,
    });

    const updated = withBuilderSessionPatch(started.session, {
      currentStage: "awaiting_review",
      specificationId: installedSpecification.specificationId,
      specificationContentHash: installedSpecification.contentHash,
      metadata: {
        ...started.session.metadata,
        continuousImprovement: true,
        baselineSpecificationVersion: installedSpecification.version,
      },
    });
    await this.aiBuilder.repository.save(updated);

    return deepFreeze({
      ok: true,
      session: updated,
      message: "Describe what to add or change. We will propose a next version — not a unrelated new install.",
      openHref: `/builder/${updated.sessionId}`,
    });
  }
}
