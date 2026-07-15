import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";
import { isIntegrationCapabilityAvailable } from "../../integrations/dependencies/ConnectionDependencyProjection.js";
import { isPmProspectCoordinatorKnowledgeReady } from "../../platform/knowledge/PlatformKnowledgeReadinessBridge.js";

export const DIGITAL_EMPLOYEE_STATUSES = {
  UNAVAILABLE: "UNAVAILABLE",
  CONFIGURING: "CONFIGURING",
  READY: "READY",
  ACTIVE: "ACTIVE",
  DEGRADED: "DEGRADED",
};

function safeArray(v) {
  return Array.isArray(v) ? v : [];
}

function capabilityReady(capabilityRuntime, capId) {
  // Universal Custom AI Worker is always available in-platform (no external install).
  if (String(capId) === "custom_ai_work") return true;
  const cap = capabilityRuntime?.getCapability?.(String(capId));
  return Boolean(cap && String(cap.status).toLowerCase() === "active");
}

function knowledgeReady(companyRuntime, categoryId, platformKnowledgeCoverage) {
  return isPmProspectCoordinatorKnowledgeReady({
    companyRuntime,
    categoryId,
    platformKnowledgeCoverage,
  });
}

export function buildDigitalEmployeeReadiness({
  employeeDefinition,
  capabilityRuntime,
  companyRuntime,
  connectedSystemsSnapshot,
  connectionRuntime,
  teamMember,
  platformKnowledgeCoverage = null,
} = {}) {
  const def = employeeDefinition ?? {};
  const employeeId = String(def.id ?? "");
  const requiredCapabilities = safeArray(def.capabilities).map(String);
  const requiredKnowledge = safeArray(def.knowledgeRequirements).map(String);

  const missingCapabilities = requiredCapabilities.filter((id) => !capabilityReady(capabilityRuntime, id));
  const missingKnowledge = requiredKnowledge.filter(
    (id) => !knowledgeReady(companyRuntime, id, platformKnowledgeCoverage),
  );

  const requiredConnections = Array.isArray(def.connectionDependencies)
    ? safeArray(def.connectionDependencies)
    : safeArray(
      connectedSystemsSnapshot?.connections
        ?.filter((c) => c.requirementLevel === "required")
        .map((c) => c.id),
    );

  const missingConnections = requiredConnections.filter((connectionType) => {
    const snap = safeArray(connectedSystemsSnapshot?.connections).find((c) => c.id === connectionType);
    return !snap || snap.status !== "CONNECTED";
  });

  const integrationCapabilities = safeArray(employeeDefinition.integrationCapabilities);
  const missingIntegrationCapabilities = integrationCapabilities.filter(
    (cap) => !isIntegrationCapabilityAvailable({ capability: cap, connectionRuntime }),
  );

  const blockers = [];
  for (const id of missingCapabilities) blockers.push({ type: "capability", id, message: `Capability not ready: ${id}` });
  for (const id of missingKnowledge) blockers.push({ type: "knowledge", id, message: `Knowledge not configured: ${id}` });
  for (const id of missingConnections) blockers.push({ type: "connection", id, message: `Required connection missing: ${id}` });
  for (const cap of missingIntegrationCapabilities) {
    blockers.push({ type: "integration_capability", id: cap, message: `External capability unavailable: ${cap}` });
  }
  const ownerAdded = Boolean(
    def.ownerAdded
    || def.customAiWork
    || def.readinessState === "owner_requested"
    || def.readinessState === "custom_ai_ready"
    || String(def.id ?? "").startsWith("owner_emp_"),
  );
  const hasCustomAiWork = requiredCapabilities.includes("custom_ai_work")
    || Boolean(def.customAiWork)
    || ownerAdded;

  if (ownerAdded || hasCustomAiWork) {
    blockers.push({
      type: "outbound_approval",
      id: "outbound_always_approved",
      message: "Anything sent outside VIBETech always needs owner or manager approval.",
    });
  } else if (def.requiresApproval) {
    blockers.push({ type: "approval", id: "approval_configuration", message: "Approval configuration required for external actions." });
  }

  let status = DIGITAL_EMPLOYEE_STATUSES.UNAVAILABLE;
  if (requiredCapabilities.length > 0 && missingCapabilities.length < requiredCapabilities.length) {
    status = DIGITAL_EMPLOYEE_STATUSES.CONFIGURING;
  }
  if (missingCapabilities.length === 0 && missingKnowledge.length > 0) {
    status = DIGITAL_EMPLOYEE_STATUSES.CONFIGURING;
  }
  if (
    missingCapabilities.length === 0
    && missingKnowledge.length === 0
    && missingConnections.length === 0
    && missingIntegrationCapabilities.length === 0
    && !def.requiresApproval
  ) {
    status = DIGITAL_EMPLOYEE_STATUSES.READY;
  }
  // Custom AI Worker is ready for internal work even when owner-added.
  if (
    hasCustomAiWork
    && missingConnections.length === 0
    && missingIntegrationCapabilities.length === 0
    && !missingCapabilities.includes("custom_ai_work")
  ) {
    status = DIGITAL_EMPLOYEE_STATUSES.READY;
  }
  if ((missingConnections.length > 0 || missingIntegrationCapabilities.length > 0) && missingCapabilities.length === 0) {
    status = DIGITAL_EMPLOYEE_STATUSES.DEGRADED;
  }

  const memberStatus = String(teamMember?.status ?? "").toLowerCase();
  if (status === DIGITAL_EMPLOYEE_STATUSES.READY && ["available", "busy"].includes(memberStatus)) {
    status = DIGITAL_EMPLOYEE_STATUSES.ACTIVE;
  }

  return deepFreeze({
    employeeId,
    name: String(def.name ?? employeeId),
    role: String(def.role ?? ""),
    status,
    ownerAdded,
    customAiWork: hasCustomAiWork,
    assistedMode: false,
    requiredCapabilities,
    requiredKnowledge,
    requiredConnections: safeArray(connectedSystemsSnapshot?.connections)
      .filter((c) => c.requirementLevel === "required")
      .map((c) => c.id),
    missingCapabilities,
    missingKnowledge,
    canCurrently: deepFreeze({
      internalCapabilities: requiredCapabilities.filter((id) => !missingCapabilities.includes(id)),
      externalCapabilities: integrationCapabilities.filter((cap) => !missingIntegrationCapabilities.includes(cap)),
      askAssisted: true,
      customAiJobs: hasCustomAiWork && status !== DIGITAL_EMPLOYEE_STATUSES.UNAVAILABLE,
    }),
    cannotCurrently: deepFreeze({
      externalCapabilities: missingIntegrationCapabilities,
      connections: missingConnections,
      autonomousCustomerSend: true,
    }),
    missingIntegrationCapabilities: deepFreeze(missingIntegrationCapabilities),
    blockers: deepFreeze(blockers),
    teamMemberStatus: teamMember?.status ?? null,
  });
}

export function buildDigitalEmployeeReadinessReport({
  employeeDefinitions,
  capabilityRuntime,
  companyRuntime,
  connectedSystemsSnapshot,
  connectionRuntime,
  teamRuntime,
  platformKnowledgeCoverage = null,
} = {}) {
  const members = teamRuntime?.getMembers?.() ?? [];
  const items = safeArray(employeeDefinitions).map((def) => {
    const teamMember = members.find((m) => String(m.id) === String(def.id)) ?? null;
    return buildDigitalEmployeeReadiness({
      employeeDefinition: def,
      capabilityRuntime,
      companyRuntime,
      connectedSystemsSnapshot,
      connectionRuntime,
      teamMember,
      platformKnowledgeCoverage,
    });
  });

  return deepFreeze({
    employees: deepFreeze(items),
    summary: deepFreeze({
      total: items.length,
      active: items.filter((e) => e.status === DIGITAL_EMPLOYEE_STATUSES.ACTIVE).length,
      blocked: items.filter((e) => [DIGITAL_EMPLOYEE_STATUSES.UNAVAILABLE, DIGITAL_EMPLOYEE_STATUSES.CONFIGURING].includes(e.status)).length,
      degraded: items.filter((e) => e.status === DIGITAL_EMPLOYEE_STATUSES.DEGRADED).length,
    }),
  });
}
