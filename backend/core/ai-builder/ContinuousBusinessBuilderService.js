import { deepFreeze } from "../workspace/_utils/deepFreeze.js";
import { AiBuilderService } from "./AiBuilderService.js";

const BLANK_PROMPTS = new Set([
  "",
  "improve this business",
  "new conversation",
  "new chat",
  "__new__",
]);

/**
 * Continuous improvement: load installed OS and propose next version.
 * Ask chats start empty — never seed discovery Q&A into the transcript.
 */
export class ContinuousBusinessBuilderService {
  constructor({ aiBuilder = new AiBuilderService() } = {}) {
    this.aiBuilder = aiBuilder;
  }

  async startImprovement({
    businessId,
    actorId = null,
    installedSpecification,
    prompt = null,
    intelligenceCandidateId = null,
    extraMetadata = {},
  }) {
    if (!businessId) throw new Error("ContinuousBusinessBuilderService: businessId required.");
    if (!installedSpecification) {
      return deepFreeze({
        ok: false,
        reason: "installed_specification_required",
        message: "Install a Business OS before requesting improvements.",
      });
    }

    const openingPrompt = String(prompt ?? "").trim();
    const hasOpeningPrompt = openingPrompt.length > 0
      && !BLANK_PROMPTS.has(openingPrompt.toLowerCase());

    const started = await this.aiBuilder.startSession({
      mode: "expand_existing_business",
      businessId,
      actorId,
      businessName: installedSpecification.businessProfile?.businessName ?? null,
      description: null,
    });

    const seeded = await this.aiBuilder.seedProposalState({
      sessionId: started.session.sessionId,
      specification: installedSpecification,
      extraMetadata: {
        continuousImprovement: true,
        baselineSpecificationVersion: installedSpecification.version,
        askTitle: hasOpeningPrompt ? openingPrompt.slice(0, 80) : "New conversation",
        askTitleSource: "auto",
        askTitleAutoVersion: hasOpeningPrompt ? 1 : 0,
        ...(intelligenceCandidateId ? { intelligenceCandidateId } : {}),
        ...extraMetadata,
        proposeOnly: extraMetadata.proposeOnly === true ? true : extraMetadata.proposeOnly,
        neverInstallAutomatically: extraMetadata.neverInstallAutomatically !== false
          ? Boolean(extraMetadata.neverInstallAutomatically ?? intelligenceCandidateId)
          : false,
      },
    });

    // Wipe discovery welcome / questions — continuous Ask is a clean chat.
    let durable = await this.aiBuilder.persistProposalState(
      seeded.session,
      seeded.proposalState,
      {
        currentStage: "awaiting_review",
        conversation: [],
        questions: [],
        progress: {
          percent: 100,
          label: "Ask VIBETech",
          readyForProposal: true,
        },
      },
    );

    if (hasOpeningPrompt) {
      const chatted = await this.aiBuilder.chat({
        sessionId: durable.sessionId,
        text: openingPrompt,
      });
      if (chatted?.session) durable = chatted.session;
    }

    return deepFreeze({
      ok: true,
      session: durable,
      message: "Ask anything about this business. Nothing goes live until you approve.",
      openHref: intelligenceCandidateId
        ? `/b/${businessId}/architect?sessionId=${encodeURIComponent(durable.sessionId)}&intelligenceCandidateId=${encodeURIComponent(intelligenceCandidateId)}`
        : `/b/${businessId}/architect?sessionId=${encodeURIComponent(durable.sessionId)}`,
    });
  }
}
