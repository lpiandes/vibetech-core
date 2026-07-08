import { AUTOMATION_ACTION_TYPES } from "../AutomationAction.js";

function fail(message) {
  throw new Error(`AutomationTemplateValidator: ${message}`);
}

function isPlainObject(v) {
  return Boolean(v) && typeof v === "object" && !Array.isArray(v);
}

export function validateAutomationTemplate(template) {
  if (!template || typeof template !== "object") fail("template required.");
  if (!Object.isFrozen(template)) fail("template must be frozen.");
  if (!template.id || typeof template.id !== "string") fail("template.id required.");
  if (!template.name || typeof template.name !== "string") fail("template.name required.");
  if (!isPlainObject(template.trigger)) fail("template.trigger required.");
  if (!Array.isArray(template.conditions)) fail("template.conditions required.");
  if (!Array.isArray(template.actions)) fail("template.actions required.");
  if (template.requiredConfiguration !== undefined && !Array.isArray(template.requiredConfiguration)) {
    fail("template.requiredConfiguration must be array.");
  }
  for (const a of template.actions) {
    if (!Object.values(AUTOMATION_ACTION_TYPES).includes(String(a?.actionType ?? ""))) {
      fail(`unsupported actionType in template: ${String(a?.actionType)}`);
    }
  }
  return { ok: true };
}
