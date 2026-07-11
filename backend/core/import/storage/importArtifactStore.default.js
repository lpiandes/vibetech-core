/**
 * Backend-owned import artifact store factory for scripts and Node tests.
 */
import { platformStore } from "../../platform/persistence/platformStore.js";
import { LocalFilesystemImportStorage } from "./LocalFilesystemImportStorage.js";
import { ImportArtifactStore, createImportArtifactStore as createImportArtifactStoreBase } from "./ImportArtifactStore.js";

export function createImportArtifactStore(options = {}) {
  return createImportArtifactStoreBase({
    storage: options.storage ?? new LocalFilesystemImportStorage(),
    store: options.store ?? platformStore,
  });
}

export { ImportArtifactStore };
