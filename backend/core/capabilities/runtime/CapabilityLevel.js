const MIN_LEVEL = 1;
const MAX_LEVEL = 5;

function fail(message) {
  throw new Error(`CapabilityLevel: ${message}`);
}

export function normalizeCapabilityLevel(level) {
  if (level === null || level === undefined) fail("level required.");

  if (typeof level === "number") {
    if (!Number.isFinite(level)) fail("level must be finite number.");
    const asInt = Math.round(level);
    if (asInt < MIN_LEVEL || asInt > MAX_LEVEL) fail("level out of supported range (1-5).");
    return String(asInt);
  }

  if (typeof level !== "string") fail("level must be string or number.");
  const t = level.trim();
  if (!t) fail("level must be non-empty string.");

  // Accept numeric strings (1-5) or named levels (industry-agnostic).
  if (/^\d+$/.test(t)) {
    const asInt = Number(t);
    if (asInt < MIN_LEVEL || asInt > MAX_LEVEL) fail("level out of supported range (1-5).");
  }

  return t;
}

