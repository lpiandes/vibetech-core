/**
 * Workspace-scoped runtime snapshot persistence contract.
 * Implementations store canonical runtime `_state` blobs keyed by workspace + runtime kind.
 */
export class WorkspacePersistencePort {
  async loadRuntimeSnapshots(_workspaceId) {
    throw new Error("WorkspacePersistencePort.loadRuntimeSnapshots: not implemented");
  }

  async saveRuntimeSnapshots(_workspaceId, _snapshots) {
    throw new Error("WorkspacePersistencePort.saveRuntimeSnapshots: not implemented");
  }

  async transaction(_workspaceId, fn) {
    return fn(this);
  }
}
