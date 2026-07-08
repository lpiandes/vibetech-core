const REGISTRY_GLOBAL_KEY = Symbol.for("vibetech.workspaceCompositionRegistry");

function getOrCreateGlobalRegistry() {
  if (!globalThis[REGISTRY_GLOBAL_KEY]) {
    globalThis[REGISTRY_GLOBAL_KEY] = new WorkspaceCompositionRegistry();
  }
  return globalThis[REGISTRY_GLOBAL_KEY];
}

/**
 * Process-local deterministic composition registry.
 *
 * NOT persistence. Lost on server restart.
 */
export class WorkspaceCompositionRegistry {
  constructor() {
    this.compositions = new Map();
  }

  get(workspaceId) {
    const id = String(workspaceId);
    return this.compositions.get(id) ?? null;
  }

  has(workspaceId) {
    const id = String(workspaceId);
    return this.compositions.has(id);
  }

  getOrCreate(workspaceId, factory) {
    const id = String(workspaceId);
    const existing = this.compositions.get(id);
    if (existing) return existing;
    const created = factory({ workspaceId: id });
    this.compositions.set(id, created);
    return created;
  }

  clear(workspaceId) {
    const id = String(workspaceId);
    this.compositions.delete(id);
  }

  clearAll() {
    this.compositions.clear();
  }
}

export const workspaceCompositionRegistry = getOrCreateGlobalRegistry();
