/**
 * Backend-owned CRM import orchestration singleton for scripts and Node tests.
 */
import { createImportArtifactStore } from "./storage/importArtifactStore.default.js";
import { importRunRepository } from "./persistence/importRunRepository.default.js";
import {
  CrmImportOrchestrationService,
  createCrmImportOrchestrationService,
} from "./CrmImportOrchestrationService.js";

export const crmImportOrchestrationService = createCrmImportOrchestrationService({
  repository: importRunRepository,
  artifactStore: createImportArtifactStore(),
});

export { CrmImportOrchestrationService, createCrmImportOrchestrationService };
