import { AiBuilderService } from "../../../backend/core/ai-builder/AiBuilderService.js";
import { BuilderSessionRepository } from "../../../backend/core/ai-builder/BuilderSessionRepository.js";
import { platformStore } from "../../../backend/core/platform/persistence/PostgresPlatformStore.js";

declare global {
  // eslint-disable-next-line no-var
  var __vibetechAiBuilderService: AiBuilderService | undefined;
}

export function getAiBuilderService() {
  if (!globalThis.__vibetechAiBuilderService) {
    // platformStore is a runtime Postgres adapter; JS constructor accepts any store-shaped object.
    globalThis.__vibetechAiBuilderService = new AiBuilderService({
      repository: new BuilderSessionRepository({
        platformStore: platformStore as never,
      }),
      platformStore: platformStore as never,
    });
  }
  return globalThis.__vibetechAiBuilderService;
}
