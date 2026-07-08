import { SUPPORTED_AUTOMATION_INTERNAL_EVENT_TYPES } from "./AutomationEventTypes.js";

function fail(message) {
  throw new Error(`AutomationRuntimeValidator: ${message}`);
}

function isPlainObject(v) {
  return Boolean(v) && typeof v === "object" && !Array.isArray(v);
}

export function validateAutomationRuntime(runtime) {
  if (!runtime || typeof runtime !== "object") fail("runtime required object.");
  const st = runtime._state;
  if (!st || typeof st !== "object") fail("runtime._state required object.");
  if (!Object.isFrozen(st)) {
    // Many runtimes deep-freeze after apply; keep strict.
    fail("runtime._state must be frozen.");
  }
  if (!Array.isArray(st.automations)) fail("runtime._state.automations must be array.");
  if (!Array.isArray(st.runs)) fail("runtime._state.runs must be array.");
  if (!st.metrics || typeof st.metrics !== "object") fail("runtime._state.metrics must be object.");
  if (!isPlainObject(st.metrics)) {
    // metrics is expected frozen plain object; allow deepFreeze.
  }
  return true;
}

export function validateSupportedAutomationInternalEventType(type) {
  const t = String(type ?? "");
  if (!SUPPORTED_AUTOMATION_INTERNAL_EVENT_TYPES.includes(t)) fail(`Unsupported automation internal event type: ${t}`);
  return t;
}
