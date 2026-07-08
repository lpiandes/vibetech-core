import { WorkspacePersistencePort } from "./WorkspacePersistencePort.js";

export class InMemoryWorkspacePersistence extends WorkspacePersistencePort {
  constructor() {
    super();
    this._store = new Map();
  }

  #key(workspaceId, runtimeKind) {
    return `${String(workspaceId)}:${String(runtimeKind)}`;
  }

  async loadRuntimeSnapshots(workspaceId) {
    const wid = String(workspaceId ?? "");
    const snapshots = [];
    for (const [key, entry] of this._store.entries()) {
      if (!key.startsWith(`${wid}:`)) continue;
      snapshots.push({
        kind: entry.kind,
        state: entry.state,
        schemaVersion: entry.schemaVersion ?? 1,
      });
    }
    return snapshots;
  }

  async saveRuntimeSnapshots(workspaceId, snapshots) {
    const wid = String(workspaceId ?? "");
    for (const snapshot of snapshots ?? []) {
      const kind = String(snapshot?.kind ?? "");
      if (!kind || snapshot?.state === undefined) continue;
      this._store.set(this.#key(wid, kind), {
        kind,
        state: snapshot.state,
        schemaVersion: snapshot.schemaVersion ?? 1,
      });
    }
  }

  clear(workspaceId) {
    const wid = String(workspaceId ?? "");
    for (const key of [...this._store.keys()]) {
      if (key.startsWith(`${wid}:`)) this._store.delete(key);
    }
  }

  clearAll() {
    this._store.clear();
  }
}
