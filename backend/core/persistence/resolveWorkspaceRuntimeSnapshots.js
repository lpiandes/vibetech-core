import { workspaceCompositionRegistry } from "../../../frontend/lib/workspace/WorkspaceCompositionRegistry.js";
import { loadRuntimeSnapshotsMap } from "./createWorkspacePersistence.js";

/**
 * Load durable runtime snapshots only when the in-process composition is cold.
 * Warm navigations reuse the hydrated WorkspaceCompositionRegistry entry.
 */
export async function resolveWorkspaceRuntimeSnapshots(workspaceId) {
  const id = String(workspaceId ?? "");
  if (!id || workspaceCompositionRegistry.has(id)) {
    return undefined;
  }
  return loadRuntimeSnapshotsMap(id);
}
