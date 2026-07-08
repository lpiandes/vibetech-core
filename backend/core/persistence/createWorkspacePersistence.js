import { InMemoryWorkspacePersistence } from "./InMemoryWorkspacePersistence.js";
import { PostgresWorkspacePersistence } from "./PostgresWorkspacePersistence.js";

let defaultInstance = null;
let testOverride = null;

export function setWorkspacePersistenceForTests(persistence) {
  testOverride = persistence ?? null;
}

export function resetWorkspacePersistenceForTests() {
  testOverride = null;
  defaultInstance = null;
}

export function getWorkspacePersistence() {
  if (testOverride) return testOverride;
  if (!defaultInstance) {
    const provider = String(process.env.WORKSPACE_PERSISTENCE_PROVIDER ?? "postgres").toLowerCase();
    if (provider === "memory" || !process.env.DATABASE_URL) {
      defaultInstance = new InMemoryWorkspacePersistence();
    } else {
      defaultInstance = new PostgresWorkspacePersistence();
    }
  }
  return defaultInstance;
}

export async function loadRuntimeSnapshotsMap(workspaceId, persistence) {
  const store = persistence ?? getWorkspacePersistence();
  const snapshots = await store.loadRuntimeSnapshots(workspaceId);
  const map = {};
  for (const snapshot of snapshots) {
    map[snapshot.kind] = snapshot.state;
  }
  return map;
}
