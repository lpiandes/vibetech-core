import { deepFreeze } from "../_utils/deepFreeze.js";
import { resolveWorkspaceActivation } from "./WorkspaceActivation.js";

/**
 * Process-local activation facts per workspaceId.
 * Future persistence boundary: durable store keyed by workspaceId.
 */
export class WorkspaceActivationRegistry {
  constructor() {
    this._activations = new Map();
  }

  get(workspaceId) {
    return this._activations.get(String(workspaceId ?? "")) ?? null;
  }

  ensure(workspaceId, activation) {
    const wid = String(workspaceId ?? "");
    const existing = this._activations.get(wid);
    if (existing) return existing;

    const built = resolveWorkspaceActivation({ workspaceId: wid, activation });
    this._activations.set(wid, built);
    return built;
  }

  set(workspaceId, activation) {
    const built = resolveWorkspaceActivation({ workspaceId, activation });
    this._activations.set(String(workspaceId ?? ""), built);
    return built;
  }

  list() {
    return deepFreeze([...this._activations.values()]);
  }
}

export const workspaceActivationRegistry = new WorkspaceActivationRegistry();
