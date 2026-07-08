import { CONNECTION_STATUSES } from "../connections/ConnectionStatus.js";
import { getCapabilitiesForConnectionType } from "../connections/ConnectionTypeCatalog.js";
import { INTEGRATION_CAPABILITIES } from "../capabilities/IntegrationCapability.js";
import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";

function safeArray(v) {
  return Array.isArray(v) ? v : [];
}

const CHANNEL_CAPABILITY_MAP = {
  email: INTEGRATION_CAPABILITIES.SEND_EMAIL,
  sms: INTEGRATION_CAPABILITIES.SEND_SMS,
  phone: INTEGRATION_CAPABILITIES.PLACE_VOICE_CALL,
  voice: INTEGRATION_CAPABILITIES.PLACE_VOICE_CALL,
};

function connectionIsActive(connection) {
  return connection && connection.status === CONNECTION_STATUSES.CONNECTED;
}

function capabilityAvailable({ connectionType, connectionRuntime }) {
  const conn = connectionRuntime?.getConnectionByType?.(connectionType);
  if (!connectionIsActive(conn)) return false;
  return getCapabilitiesForConnectionType(connectionType).every((cap) => conn.capabilities.includes(cap));
}

export function buildConnectionDependencyProjection({
  installationResult,
  connectionRuntime,
  employeeDefinitions,
  automationConfigurations,
} = {}) {
  const requirements = safeArray(installationResult?.connectedSystemRequirements);
  const communicationIntents = safeArray(installationResult?.communicationIntents);
  const employees = safeArray(employeeDefinitions ?? installationResult?.employeeDefinitions);
  const automations = safeArray(automationConfigurations ?? installationResult?.automationConfigurations);

  const projections = requirements.map((req) => {
    const connectionType = String(req.id ?? "");
    const capabilities = getCapabilitiesForConnectionType(connectionType);
    const runtimeConnection = connectionRuntime?.getConnectionByType?.(connectionType) ?? null;
    const isConnected = connectionIsActive(runtimeConnection);

    const enabledCommunicationIntents = communicationIntents.filter((intent) => {
      const cap = CHANNEL_CAPABILITY_MAP[String(intent.channel ?? "").toLowerCase()];
      return cap && capabilities.includes(cap) && isConnected;
    });

    const blockedEmployees = employees.filter((employee) => {
      const deps = safeArray(employee.connectionDependencies);
      if (!deps.includes(connectionType)) return false;
      return !isConnected;
    });

    const blockedAutomations = automations.filter((auto) => {
      const deps = safeArray(auto.connectionDependencies);
      if (!deps.includes(connectionType)) return false;
      return !isConnected;
    });

    return deepFreeze({
      connectionType,
      displayName: String(req.displayName ?? connectionType),
      requirementLevel: String(req.requirementLevel ?? "optional"),
      status: runtimeConnection?.status ?? CONNECTION_STATUSES.NOT_CONNECTED,
      isConnected,
      enables: deepFreeze({
        capabilities: isConnected ? capabilities : [],
        communicationIntents: enabledCommunicationIntents.map((i) => i.id),
        employees: isConnected
          ? employees
              .filter((e) => !blockedEmployees.find((b) => b.id === e.id))
              .map((e) => e.id)
          : [],
        automations: isConnected
          ? automations.filter((a) => !blockedAutomations.find((b) => b.id === a.id)).map((a) => a.id)
          : [],
      }),
      blockedWithout: deepFreeze({
        capabilities: isConnected ? [] : capabilities,
        employees: blockedEmployees.map((e) => ({ id: e.id, name: e.name })),
        automations: blockedAutomations.map((a) => a.id),
        communicationIntents: communicationIntents
          .filter((intent) => {
            const cap = CHANNEL_CAPABILITY_MAP[String(intent.channel ?? "").toLowerCase()];
            return cap && capabilities.includes(cap) && !isConnected;
          })
          .map((i) => i.id),
      }),
    });
  });

  return deepFreeze({
    connections: deepFreeze(projections),
    availableCapabilities: deepFreeze(
      projections
        .filter((p) => p.isConnected)
        .flatMap((p) => p.enables.capabilities),
    ),
  });
}

export function isIntegrationCapabilityAvailable({ capability, connectionRuntime } = {}) {
  const cap = String(capability ?? "");
  for (const conn of connectionRuntime?.getConnections?.() ?? []) {
    if (connectionIsActive(conn) && conn.capabilities.includes(cap)) return true;
  }
  return false;
}
