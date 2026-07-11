/**
 * Backend-owned import run repository singleton for scripts and Node tests.
 */
import { platformStore } from "../../platform/persistence/platformStore.js";
import { ImportRunRepository, createImportRunRepository } from "./ImportRunRepository.js";

export const importRunRepository = createImportRunRepository({ store: platformStore });
export { ImportRunRepository, createImportRunRepository };
