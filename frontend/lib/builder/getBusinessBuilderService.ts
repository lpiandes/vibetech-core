import { BusinessBuilderService } from "../../../backend/core/business-builder/BusinessBuilderService.js";

declare global {
  // eslint-disable-next-line no-var
  var __vibetechBusinessBuilderService: BusinessBuilderService | undefined;
}

export function getBusinessBuilderService() {
  if (!globalThis.__vibetechBusinessBuilderService) {
    globalThis.__vibetechBusinessBuilderService = new BusinessBuilderService();
  }
  return globalThis.__vibetechBusinessBuilderService;
}
