import { exportRuntimeSnapshots } from "./exportRuntimeSnapshots.js";
import { getWorkspacePersistence } from "./createWorkspacePersistence.js";

export async function persistAffectedRuntimes({
  workspaceId,
  stack,
  integrationPlatform,
  kinds,
  persistence,
} = {}) {
  const store = persistence ?? getWorkspacePersistence();
  const snapshots = exportRuntimeSnapshots({ stack, integrationPlatform, kinds });
  if (!snapshots.length) return;
  await store.saveRuntimeSnapshots(String(workspaceId ?? ""), snapshots);
}
