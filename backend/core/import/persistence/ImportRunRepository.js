export class ImportRunRepository {
  constructor({ store } = {}) {
    if (!store) throw new Error("ImportRunRepository requires a platform store");
    this.store = store;
  }

  createArtifact(args) {
    return this.store.createImportArtifact(args);
  }

  getArtifact(artifactId, businessId) {
    return this.store.getImportArtifactById(artifactId, businessId);
  }

  createRun(args) {
    return this.store.createImportRun(args);
  }

  getRun(runId, businessId) {
    return this.store.getImportRunById(runId, businessId);
  }

  updateRun(runId, businessId, patch) {
    return this.store.updateImportRun(runId, businessId, patch);
  }

  replaceRowResults(importRunId, rows) {
    return this.store.deleteImportRunRowResults(importRunId).then(() =>
      this.store.insertImportRunRowResults(importRunId, rows),
    );
  }

  upsertRowResults(importRunId, rows) {
    return this.store.insertImportRunRowResults(importRunId, rows);
  }

  listRowResults(args) {
    return this.store.listImportRunRowResults(args);
  }

  listAllRowResults(args) {
    return this.store.listAllImportRunRowResults(args);
  }

  updateRowCommitState(args) {
    return this.store.updateImportRunRowCommitState(args);
  }

  countRowResults(importRunId) {
    return this.store.countImportRunRowResults(importRunId);
  }
}

export function createImportRunRepository(deps) {
  return new ImportRunRepository(deps);
}
