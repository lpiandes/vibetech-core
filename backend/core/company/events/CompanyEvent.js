function deepFreeze(value) {
  if (!value || typeof value !== "object") return value;
  if (Object.isFrozen(value)) return value;

  for (const key of Object.keys(value)) {
    deepFreeze(value[key]);
  }

  return Object.freeze(value);
}

function generateId(prefix = "evt") {
  const rand = Math.random().toString(16).slice(2);
  return `${prefix}_${Date.now()}_${rand}`;
}

/**
 * @param {object} input
 * @param {string=} input.id
 * @param {string=} input.timestampISO
 * @param {string} input.type
 * @param {string} input.source
 * @param {object} input.payload
 */
export function createCompanyEvent({ id, timestampISO, type, source, payload }) {
  if (!type || typeof type !== "string") {
    throw new Error("createCompanyEvent: `type` must be a string.");
  }
  if (!source || typeof source !== "string") {
    throw new Error("createCompanyEvent: `source` must be a string.");
  }
  if (!payload || typeof payload !== "object") {
    throw new Error("createCompanyEvent: `payload` must be an object.");
  }

  const event = {
    id: String(id ?? generateId("evt")),
    timestamp: String(timestampISO ?? new Date().toISOString()),
    type,
    source,
    payload: deepFreeze({ ...payload }),
  };

  return deepFreeze(event);
}

