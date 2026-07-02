import { deepFreeze } from "./_utils/deepFreeze.js";

function normalizeId(id) {
  return String(id);
}

function detectCycles(capabilitiesById) {
  // capabilitiesById: Map<string, capabilityDef>
  const visiting = new Set();
  const visited = new Set();
  const cycles = [];

  const dfs = (id, stack) => {
    const nextId = normalizeId(id);
    if (visited.has(nextId)) return;
    if (visiting.has(nextId)) {
      // find the cycle slice
      const idx = stack.indexOf(nextId);
      cycles.push(stack.slice(idx).concat(nextId));
      return;
    }
    visiting.add(nextId);
    const cap = capabilitiesById.get(nextId);
    const deps = cap?.dependencies ?? [];
    const nextStack = [...stack, nextId];
    for (const dep of deps) dfs(dep, nextStack);
    visiting.delete(nextId);
    visited.add(nextId);
  };

  for (const id of capabilitiesById.keys()) dfs(id, []);
  // Deduplicate identical cycles by serialized form.
  const uniq = new Map();
  for (const c of cycles) {
    const key = c.join("->");
    uniq.set(key, c);
  }
  return [...uniq.values()];
}

export class CapabilityDependencyResolver {
  constructor({ registry } = {}) {
    if (!registry) throw new Error("CapabilityDependencyResolver requires registry.");
    this.registry = registry;
  }

  detectCircularDependencies() {
    const capabilitiesById = new Map(this.registry.list().map((c) => [c.id, c]));
    return detectCycles(capabilitiesById);
  }

  getTopologicalOrder() {
    const caps = this.registry.list();
    const byId = new Map(caps.map((c) => [String(c.id), c]));
    const indegree = new Map();
    const outgoing = new Map();

    for (const cap of caps) {
      indegree.set(String(cap.id), 0);
      outgoing.set(String(cap.id), []);
    }

    for (const cap of caps) {
      const id = String(cap.id);
      for (const depId of cap.dependencies ?? []) {
        const depKey = String(depId);
        if (!byId.has(depKey)) continue;
        indegree.set(id, (indegree.get(id) ?? 0) + 1);
        outgoing.get(depKey).push(id);
      }
    }

    const queue = [];
    for (const [id, deg] of indegree.entries()) {
      if (deg === 0) queue.push(id);
    }

    queue.sort((a, b) => a.localeCompare(b));

    const order = [];
    while (queue.length) {
      const id = queue.shift();
      order.push(id);

      for (const nextId of outgoing.get(id) ?? []) {
        const deg = (indegree.get(nextId) ?? 0) - 1;
        indegree.set(nextId, deg);
        if (deg === 0) queue.push(nextId);
      }
      queue.sort((a, b) => a.localeCompare(b));
    }

    // If order doesn't include all nodes, there is a cycle.
    if (order.length !== caps.length) {
      const circular = this.detectCircularDependencies();
      throw new Error(`CapabilityDependencyResolver: circular dependencies detected: ${JSON.stringify(circular)}`);
    }

    return order;
  }

  /**
   * Resolves dependency-derived blockers.
   *
   * @param {object} params
   * @param {object} params.evaluatedById capabilityId -> { status }
   */
  resolveBlockedByDependencies({ evaluatedById } = {}) {
    const result = {};

    for (const cap of this.registry.list()) {
      const blockedBy = [];
      for (const depId of cap.dependencies ?? []) {
        const dep = evaluatedById[String(depId)];
        if (!dep) continue;
        const isDepNotReady =
          dep.status === "BLOCKED" ||
          dep.status === "NOT_STARTED" ||
          dep.status === "IN_PROGRESS" ||
          dep.status === "DEGRADED" ||
          dep.status === "DISABLED";
        if (isDepNotReady) blockedBy.push(String(depId));
      }
      result[String(cap.id)] = deepFreeze({
        blockedBy,
      });
    }

    return deepFreeze(result);
  }
}

