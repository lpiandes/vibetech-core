/**
 * Backend-owned knowledge service singleton for scripts and Node tests.
 * Next.js must use frontend/lib/server/compose.ts instead.
 */
import { platformStore } from "../persistence/platformStore.js";
import { createKnowledgeStorageProvider } from "./createKnowledgeStorageProvider.js";
import { BusinessKnowledgeService, createBusinessKnowledgeService } from "./BusinessKnowledgeService.js";

export const businessKnowledgeService = createBusinessKnowledgeService({
  store: platformStore,
  storage: createKnowledgeStorageProvider(),
});

export { BusinessKnowledgeService, createBusinessKnowledgeService };
