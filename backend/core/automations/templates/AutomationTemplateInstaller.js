import crypto from "node:crypto";

import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";

import { createAutomationDefinition } from "../AutomationDefinition.js";
import { createAutomationTrigger } from "../AutomationTrigger.js";
import { createAutomationCondition } from "../AutomationCondition.js";
import { createAutomationAction } from "../AutomationAction.js";

import { AUTOMATION_INTERNAL_EVENT_TYPES } from "../AutomationEventTypes.js";

import { stableStringify } from "../../knowledge/intelligence/utils/stableStringify.js";

import { resolveConfigValueSpecs } from "./_configResolve.js";

function fail(message) {
  throw new Error(`AutomationTemplateInstaller: ${message}`);
}

function sha256(str) {
  return crypto.createHash("sha256").update(String(str)).digest("hex");
}

function requirePlainObject(v, name) {
  const ok = Boolean(v) && typeof v === "object" && !Array.isArray(v);
  if (!ok) fail(`${name} required plain object.`);
  return v;
}

function deterministicAutomationDefinitionId({ templateId, configuration } = {}) {
  const cfg = configuration ?? {};
  const fingerprint = sha256(stableStringify(cfg));
  return `aut_tpl_${String(templateId)}_${fingerprint}`;
}

export function installAutomationTemplate({
  template,
  configuration,
  automationRuntime,
  nowISO,
} = {}) {
  if (!template || typeof template !== "object") fail("template required.");
  if (!automationRuntime || typeof automationRuntime.applyEvent !== "function") fail("automationRuntime required.");
  const cfg = requirePlainObject(configuration ?? {}, "configuration");

  const required = Array.isArray(template.requiredConfiguration) ? template.requiredConfiguration : [];
  for (const r of required) {
    const key = String(r?.key ?? "");
    if (!key) continue;
    if (!(key in cfg)) fail(`Missing required configuration key: ${key}`);
  }

  const resolvedTrigger = resolveConfigValueSpecs(template.trigger, cfg);
  const resolvedConditions = resolveConfigValueSpecs(template.conditions, cfg);
  const resolvedActions = resolveConfigValueSpecs(template.actions, cfg);

  const automationId = deterministicAutomationDefinitionId({ templateId: template.id, configuration: cfg });
  const timestampISO = String(nowISO ?? automationRuntime.nowISO ?? "2026-07-01T00:00:00.000Z");

  // Build canonical AutomationDefinition.
  const automation = createAutomationDefinition({
    id: automationId,
    name: String(template.name),
    description: String(template.description),
    status: String(template.status),
    version: template.version,
    priority: 0,
    metadata: deepFreeze({ derivedFrom: { templateId: template.id } }),
    createdAt: timestampISO,
    updatedAt: timestampISO,
    trigger: createAutomationTrigger(resolvedTrigger),
    conditions: (Array.isArray(resolvedConditions) ? resolvedConditions : []).map((c) => createAutomationCondition(c)),
    actions: (Array.isArray(resolvedActions) ? resolvedActions : []).map((a) => {
      const built = createAutomationAction(a);
      // Keep deterministic ordering metadata stable.
      return built;
    }),
  });

  const existing = automationRuntime.getAutomationById?.(automationId) ?? null;
  if (!existing) {
    const runEventId = `evt_automation_installed_${automationId}_${timestampISO}`;
    automationRuntime.applyEvent({
      id: runEventId,
      timestampISO,
      type: AUTOMATION_INTERNAL_EVENT_TYPES.AUTOMATION_REGISTERED,
      payload: { automation },
    });
  }

  return deepFreeze({ automationId, definition: automation });
}
