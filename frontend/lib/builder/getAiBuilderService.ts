import { AiBuilderService } from "../../../backend/core/ai-builder/AiBuilderService.js";
import { BuilderSessionRepository } from "../../../backend/core/ai-builder/BuilderSessionRepository.js";
import { BusinessWebsiteResearchService } from "../../../backend/core/ai-builder/BusinessWebsiteResearchService.js";
import { OptionalAIBuilderIntelligenceProvider } from "../../../backend/core/ai-builder/BuilderIntelligenceProvider.js";
import { OpenAIBuilderIntelligenceClient } from "../../../backend/core/ai-builder/OpenAIBuilderIntelligenceClient.js";
import { llmIsLiveAvailable } from "../../../backend/core/providers/createLlmProvider.js";
import { platformStore } from "@/lib/server/compose";

declare global {
  // eslint-disable-next-line no-var
  var __vibetechAiBuilderService: AiBuilderService | undefined;
  // eslint-disable-next-line no-var
  var __vibetechAiBuilderServiceRevision: number | undefined;
}

/** Bump when AiBuilderService public API changes so HMR cannot keep a stale singleton. */
// Rebuild after package-Ask skips already-connected accounts.
const AI_BUILDER_SERVICE_REVISION = 16;

export function getAiBuilderService() {
  const existing = globalThis.__vibetechAiBuilderService as
    | (AiBuilderService & { researchService?: { fetchImpl?: unknown }; applyPlanChanges?: unknown })
    | undefined;

  const revisionMismatch = globalThis.__vibetechAiBuilderServiceRevision !== AI_BUILDER_SERVICE_REVISION;
  // Hot-reload / old process may hold a service constructed without live fetch or new methods.
  if (
    revisionMismatch
    || (existing && !existing.researchService?.fetchImpl)
    || (existing && typeof existing.applyPlanChanges !== "function")
  ) {
    globalThis.__vibetechAiBuilderService = undefined;
  }

  if (!globalThis.__vibetechAiBuilderService) {
    const live = llmIsLiveAvailable();
    const intelligence = new OptionalAIBuilderIntelligenceProvider({
      enabled: live,
      client: live ? new OpenAIBuilderIntelligenceClient() : null,
    });
    // platformStore is a runtime Postgres adapter; JS constructor accepts any store-shaped object.
    // Wire live fetch so website review works in local/dev — service defaults to null for unit tests.
    globalThis.__vibetechAiBuilderService = new AiBuilderService({
      repository: new BuilderSessionRepository({
        platformStore: platformStore as never,
      }),
      platformStore: platformStore as never,
      researchService: new BusinessWebsiteResearchService({
        fetchImpl: globalThis.fetch.bind(globalThis),
      }),
      intelligence,
    });
    globalThis.__vibetechAiBuilderServiceRevision = AI_BUILDER_SERVICE_REVISION;
  }
  return globalThis.__vibetechAiBuilderService;
}
