function deepFreeze(value) {
  if (!value || typeof value !== "object") return value;
  if (Object.isFrozen(value)) return value;
  for (const k of Object.keys(value)) deepFreeze(value[k]);
  return Object.freeze(value);
}

export function createConnectedSystem(input = {}) {
  const {
    id,
    name,
    category,
    provider,
    status,
    health,
    configured,
    authenticated,
    lastValidated,
    features,
    capabilitiesUnlocked,
    metadata,
  } = input ?? {};

  if (typeof id !== "string" || !id.trim()) throw new Error("ConnectedSystem: id required.");
  if (typeof name !== "string" || !name.trim()) throw new Error("ConnectedSystem: name required.");
  if (typeof category !== "string" || !category.trim()) throw new Error("ConnectedSystem: category required.");
  if (typeof provider !== "string") throw new Error("ConnectedSystem: provider required.");

  const allowedStatuses = new Set([
    "NOT_STARTED",
    "IN_PROGRESS",
    "READY",
    "BLOCKED",
    "DEGRADED",
    "DISABLED",
  ]);
  if (typeof status !== "string" || !allowedStatuses.has(status)) {
    throw new Error(`ConnectedSystem: invalid status: ${String(status)}`);
  }

  if (typeof health !== "string" || !health.trim()) throw new Error("ConnectedSystem: health required.");

  const next = {
    id: String(id),
    name: String(name),
    category: String(category),
    provider: String(provider),
    status: String(status),
    health: String(health),
    configured: Boolean(configured),
    authenticated: Boolean(authenticated),
    lastValidated: String(lastValidated ?? ""),
    features: Array.isArray(features) ? deepFreeze(features.map(String)) : deepFreeze([]),
    capabilitiesUnlocked: Array.isArray(capabilitiesUnlocked)
      ? deepFreeze(capabilitiesUnlocked.map(String))
      : deepFreeze([]),
    metadata: metadata && typeof metadata === "object" ? deepFreeze(metadata) : deepFreeze({}),
  };

  return deepFreeze(next);
}

