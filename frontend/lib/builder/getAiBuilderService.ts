import { AiBuilderService } from "../../../backend/core/ai-builder/AiBuilderService.js";

declare global {
  // eslint-disable-next-line no-var
  var __vibetechAiBuilderService: AiBuilderService | undefined;
}

export function getAiBuilderService() {
  if (!globalThis.__vibetechAiBuilderService) {
    globalThis.__vibetechAiBuilderService = new AiBuilderService();
  }
  return globalThis.__vibetechAiBuilderService;
}
