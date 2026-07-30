import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";
import { createAutomationDefinition } from "../../automations/AutomationDefinition.js";
import { createAutomationTrigger } from "../../automations/AutomationTrigger.js";
import { AUTOMATION_INTERNAL_EVENT_TYPES } from "../../automations/AutomationEventTypes.js";
import {
  buildAutomationStubFromContract,
  buildOperatingContract,
} from "../operating-contract/buildOperatingContract.js";

export const SPECIALTY_TRIGGER_EVENT_TYPES = Object.freeze([
  "SCHEDULE_CHANGE",
  "EVENT_UPDATE",
  "EVENT_REMINDER_DUE",
  "ANNOUNCEMENT_REQUESTED",
  "SPECIALTY_JOB_REQUESTED",
  "SPECIALTY_SCHEDULE_DUE",
  "NEW_INQUIRY",
  "INBOUND_VOICE_CALL",
  "SOCIAL_SCREEN_REQUESTED",
  "FORM_SUBMIT",
  "META_LEAD",
  "PRACTICE_SCHEDULED",
  "COACH_REQUEST",
  "TOURNAMENT_PLANNING",
  "SEASON_MILESTONE",
  "RECALL_DUE",
  "REACTIVATION_LIST",
  "INTERACTION_OUTCOME_RECORDED",
  "PIPELINE_STAGE_ENTERED",
  "PIPELINE_CARD_CREATED",
]);

/**
 * Build a runtime-ready AutomationDefinition from an operating-contract stub.
 * Primary eventType is used for RuleEngine match; all eventTypes live in metadata.
 */
export function buildOperatingContractAutomationDefinition({
  employee = {},
  industry = null,
  nowISO = null,
  status = "INACTIVE",
} = {}) {
  const employeeId = String(employee.employeeId ?? employee.id ?? "").trim();
  if (!employeeId) return null;

  const built = employee.operatingContract?.version
    ? { contract: employee.operatingContract }
    : buildOperatingContract({ employee, industry });
  const contract = built.contract ?? employee.operatingContract;
  const stub = buildAutomationStubFromContract({ employee, contract });
  if (!stub) return null;

  const timestampISO = String(nowISO ?? new Date().toISOString());
  const eventTypes = Array.isArray(stub.trigger?.eventTypes) && stub.trigger.eventTypes.length
    ? stub.trigger.eventTypes.map(String)
    : [String(stub.trigger?.eventType ?? "SPECIALTY_JOB_REQUESTED")];
  // Always accept manual + schedule due so Active automations respond to Mission/schedule too.
  const expanded = Array.from(new Set([
    ...eventTypes,
    "SPECIALTY_JOB_REQUESTED",
    "SPECIALTY_SCHEDULE_DUE",
  ]));
  const primaryEvent = expanded[0];

  const automationId = String(stub.automationId || `auto_contract_${employeeId}`);
  const label = String(employee.label ?? employee.name ?? employeeId);

  return createAutomationDefinition({
    id: automationId,
    name: String(stub.name ?? `${label} — specialty work`),
    description: String(contract?.executes?.summary ?? "Specialty draft work for owner review"),
    status: String(status) === "ACTIVE" ? "ACTIVE" : "INACTIVE",
    version: 1,
    priority: 10,
    createdAt: timestampISO,
    updatedAt: timestampISO,
    metadata: deepFreeze({
      employeeId,
      fromOperatingContract: true,
      schemaId: contract?.schemaId ?? null,
      eventTypes: expanded,
      triggerSummary: contract?.trigger?.summary ?? "",
      executesSummary: contract?.executes?.summary ?? "",
      mode: contract?.trigger?.mode ?? "manual_or_events",
    }),
    trigger: createAutomationTrigger({
      eventType: primaryEvent,
      sourceTypes: ["specialty", "operating_contract"],
      filters: {},
      metadata: deepFreeze({ eventTypes: expanded, employeeId }),
    }),
    conditions: [],
    // Status + event subscription only — drafts are created by fireSpecialtyTrigger / schedule worker.
    actions: [],
  });
}

/**
 * Ensure employee operating-contract automation exists in AutomationRuntime.
 * Returns the automation id.
 */
export function ensureEmployeeOperatingAutomationRegistered({
  automationRuntime,
  employee,
  industry = null,
  nowISO = null,
  preferredStatus = null,
} = {}) {
  if (!automationRuntime?.applyEvent || !automationRuntime?.getAutomationById) {
    throw new Error("ensureEmployeeOperatingAutomationRegistered: automationRuntime required");
  }
  const employeeId = String(employee?.employeeId ?? employee?.id ?? "").trim();
  if (!employeeId) throw new Error("ensureEmployeeOperatingAutomationRegistered: employeeId required");

  const timestampISO = String(nowISO ?? automationRuntime.nowISO ?? new Date().toISOString());
  const existing = (automationRuntime.getAutomations?.() ?? []).find((auto) => {
    const linked = String(auto?.metadata?.employeeId ?? "");
    return linked === employeeId || String(auto?.id ?? "").includes(employeeId);
  }) ?? null;

  if (existing) {
    return deepFreeze({
      automationId: String(existing.id),
      registered: false,
      status: String(existing.status),
      definition: existing,
    });
  }

  const status = preferredStatus
    ?? (String(employee?.automationDefinitions?.[0]?.status).toUpperCase() === "ACTIVE"
      ? "ACTIVE"
      : employee?.activateOnInstall === true
        ? "ACTIVE"
        : employee?.packDefault === true && employee?.activateOnInstall !== false
          ? "ACTIVE"
          : "INACTIVE");
  const definition = buildOperatingContractAutomationDefinition({
    employee,
    industry,
    nowISO: timestampISO,
    status,
  });
  if (!definition) {
    throw new Error("ensureEmployeeOperatingAutomationRegistered: could not build definition");
  }

  automationRuntime.applyEvent({
    id: `evt_automation_registered_${definition.id}_${timestampISO}`,
    timestampISO,
    type: AUTOMATION_INTERNAL_EVENT_TYPES.AUTOMATION_REGISTERED,
    payload: { automation: definition },
  });

  return deepFreeze({
    automationId: definition.id,
    registered: true,
    status: String(definition.status ?? status).toUpperCase(),
    intendedStatus: status,
    definition,
  });
}

/**
 * Match ACTIVE specialty automations that listen for this event type
 * (primary trigger.eventType OR metadata.eventTypes).
 */
export function specialtyAutomationMatchesEvent(automation, eventType) {
  const type = String(eventType ?? "");
  if (!type) return false;
  if (String(automation?.status ?? "").toUpperCase() !== "ACTIVE") return false;
  if (!automation?.metadata?.fromOperatingContract && !automation?.metadata?.employeeId) {
    // still allow match on eventTypes metadata
  }
  if (String(automation?.trigger?.eventType ?? "") === type) return true;
  const extras = [
    ...(Array.isArray(automation?.trigger?.metadata?.eventTypes) ? automation.trigger.metadata.eventTypes : []),
    ...(Array.isArray(automation?.metadata?.eventTypes) ? automation.metadata.eventTypes : []),
  ].map(String);
  return extras.includes(type);
}
