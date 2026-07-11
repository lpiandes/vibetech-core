import { deepFreeze } from "../workspace/_utils/deepFreeze.js";
import { AiBuilderService } from "./AiBuilderService.js";

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

    const seeded = await this.aiBuilder.seedProposalState({
      sessionId: started.session.sessionId,
      specification: installedSpecification,
      extraMetadata: {
        continuousImprovement: true,
        baselineSpecificationVersion: installedSpecification.version,
      },
    });

    const durable = await this.aiBuilder.persistProposalState(
      seeded.session,
      seeded.proposalState,
      { currentStage: "awaiting_review" },
    );

    return deepFreeze({
      ok: true,
      session: durable,
      message: "Describe what to add or change. We will propose a next version — not a unrelated new install.",
      openHref: `/builder/${durable.sessionId}`,
    });
  }
}
