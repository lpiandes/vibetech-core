function deepFreeze(value) {
  if (!value || typeof value !== "object") return value;
  if (Object.isFrozen(value)) return value;
  for (const key of Object.keys(value)) deepFreeze(value[key]);
  return Object.freeze(value);
}

function generateId(prefix = "ob_evt") {
  const rand = Math.random().toString(16).slice(2);
  return `${prefix}_${Date.now()}_${rand}`;
}

/**
 * Onboarding event shape mirrors the Company Event Engine:
 * { id, timestamp, type, source, payload }
 */
export function createOnboardingEvent({ id, timestampISO, type, source, payload }) {
  if (!type || typeof type !== "string") throw new Error("createOnboardingEvent: `type` must be a string.");
  if (!source || typeof source !== "string") throw new Error("createOnboardingEvent: `source` must be a string.");
  if (!payload || typeof payload !== "object") throw new Error("createOnboardingEvent: `payload` must be an object.");

  const event = {
    id: String(id ?? generateId()),
    timestamp: String(timestampISO ?? new Date().toISOString()),
    type,
    source,
    payload: deepFreeze({ ...payload }),
  };

  return deepFreeze(event);
}

