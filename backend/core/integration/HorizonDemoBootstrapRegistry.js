import { deepFreeze } from "../workspace/_utils/deepFreeze.js";

export const HORIZON_DEMO_BOOTSTRAP_VERSION = "epic23_v1";
export const HORIZON_WORKSPACE_ID = "ws_horizon_properties";

const compositionCache = new Map();
const bootstrapMarkers = new Map();

export function getHorizonCompositionCache(workspaceId = HORIZON_WORKSPACE_ID) {
  return compositionCache.get(String(workspaceId)) ?? null;
}

export function setHorizonCompositionCache(workspaceId, composition) {
  compositionCache.set(String(workspaceId), composition);
  return composition;
}

export function isHorizonBootstrapMarked(workspaceId = HORIZON_WORKSPACE_ID, version = HORIZON_DEMO_BOOTSTRAP_VERSION) {
  return bootstrapMarkers.get(String(workspaceId)) === String(version);
}

export function markHorizonBootstrapComplete(workspaceId = HORIZON_WORKSPACE_ID, version = HORIZON_DEMO_BOOTSTRAP_VERSION) {
  bootstrapMarkers.set(String(workspaceId), String(version));
  return deepFreeze({ workspaceId: String(workspaceId), version: String(version), completedAt: new Date().toISOString() });
}

export function resetHorizonDemoWorkspace({ workspaceId = HORIZON_WORKSPACE_ID } = {}) {
  const wid = String(workspaceId);
  compositionCache.delete(wid);
  bootstrapMarkers.delete(wid);
  return { workspaceId: wid, reset: true };
}

/**
 * Development-only demo reset:
 * 1. resetHorizonDemoWorkspace({ workspaceId: "ws_horizon_properties" })
 * 2. workspaceCompositionRegistry.clear("ws_horizon_properties") in the frontend process
 * 3. Reload any route — activateWorkspace runs configure + bootstrap again deterministically
 */
