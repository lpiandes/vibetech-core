import { deepFreeze } from "../workspace/_utils/deepFreeze.js";

function fail(message) {
  throw new Error(`BlueprintDependencyResolver: ${message}`);
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

/**
 * Resolves blueprint dependency order. Detects cycles and missing deps.
 */
export function resolveBlueprintDependencies(blueprint, { registry } = {}) {
  if (!blueprint) fail("blueprint required.");
  if (!registry) fail("registry required.");

  const resolved = [];
  const visiting = new Set();
  const visited = new Set();

  function visit(blueprintId) {
    const id = String(blueprintId);
    if (visited.has(id)) return;
    if (visiting.has(id)) {
      fail(`circular dependency involving ${id}`);
    }
    visiting.add(id);
    const entry = registry.get(id);
    if (!entry) fail(`missing dependency: ${id}`);
    for (const dep of asArray(entry.dependencies)) {
      const depId = typeof dep === "string" ? dep : dep.blueprintId;
      visit(depId);
    }
    visiting.delete(id);
    visited.add(id);
    resolved.push(entry);
  }

  for (const dep of asArray(blueprint.dependencies)) {
    const depId = typeof dep === "string" ? dep : dep.blueprintId;
    visit(depId);
  }

  if (!visited.has(blueprint.blueprintId)) {
    resolved.push(blueprint);
  }

  return deepFreeze({
    ok: true,
    order: resolved.map((entry) => entry.blueprintId),
    blueprints: resolved,
  });
}
