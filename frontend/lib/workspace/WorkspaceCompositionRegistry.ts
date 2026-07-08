export type WorkspaceId = string;

const REGISTRY_GLOBAL_KEY = Symbol.for("vibetech.workspaceCompositionRegistry");

function getOrCreateGlobalRegistry(): WorkspaceCompositionRegistry {
  const globalStore = globalThis as typeof globalThis & {
    [REGISTRY_GLOBAL_KEY]?: WorkspaceCompositionRegistry;
  };
  if (!globalStore[REGISTRY_GLOBAL_KEY]) {
    globalStore[REGISTRY_GLOBAL_KEY] = new WorkspaceCompositionRegistry();
  }
  return globalStore[REGISTRY_GLOBAL_KEY];
}

/**
 * Process-local development composition registry.
 *
 * - Keyed by `workspaceId`
 * - Reuses the same ConnectedBusinessWorkspace instance in-memory
 * - Non-durable: lost on server restart
 *
 * This registry is intentionally NOT persistence.
 */
export class WorkspaceCompositionRegistry {
  private readonly compositions = new Map<WorkspaceId, any>();

  get(workspaceId: WorkspaceId) {
    const id = String(workspaceId);
    return this.compositions.get(id) ?? null;
  }

  has(workspaceId: WorkspaceId) {
    const id = String(workspaceId);
    return this.compositions.has(id);
  }

  getOrCreate<T>(workspaceId: WorkspaceId, factory: WorkspaceCompositionFactory<T>): T {
    const id = String(workspaceId);
    const existing = this.compositions.get(id);
    if (existing) return existing as T;

    const created = factory({ workspaceId: id });
    this.compositions.set(id, created);
    return created;
  }

  clear(workspaceId: WorkspaceId) {
    const id = String(workspaceId);
    this.compositions.delete(id);
  }

  clearAll() {
    this.compositions.clear();
  }
}

export type WorkspaceCompositionFactory<T> = (params: { workspaceId: WorkspaceId }) => T;

// One registry per process, shared across Next.js RSC/API bundles via globalThis.
export const workspaceCompositionRegistry = getOrCreateGlobalRegistry();
