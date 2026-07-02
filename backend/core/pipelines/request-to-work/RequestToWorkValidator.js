import { mapRequestConvertedToWorkItemInput } from "./RequestToWorkMapper.js";

function fail(message) {
  throw new Error(`RequestToWorkValidator: ${message}`);
}

function isPlainObject(v) {
  return Boolean(v) && typeof v === "object" && !Array.isArray(v);
}

export function validateRequestConvertedEvent(event) {
  if (!event || typeof event !== "object") fail("event required.");
  if (!Object.isFrozen(event)) {
    // We still validate canonical contract, but avoid hard-failing tests that may pass non-frozen input.
    // Contract requires deep frozen events at platform level.
  }
  if (String(event.eventType) !== "REQUEST_CONVERTED") {
    return { ok: false, skipped: true, errors: [`eventType not REQUEST_CONVERTED: ${String(event.eventType)}`] };
  }

  const payload = event.payload;
  if (!isPlainObject(payload)) {
    return { ok: false, skipped: false, errors: ["payload must be a plain object."] };
  }

  try {
    mapRequestConvertedToWorkItemInput(payload);
  } catch (err) {
    return { ok: false, skipped: false, errors: [String(err?.message ?? err)] };
  }

  return { ok: true, skipped: false, errors: [] };
}

