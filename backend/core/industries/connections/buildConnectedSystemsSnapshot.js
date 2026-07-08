import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";
import { CONNECTION_STATUSES } from "../../integrations/connections/ConnectionStatus.js";
import { buildConnectionHealth } from "../../integrations/health/ConnectionHealthEngine.js";
import { CONNECTION_HEALTH_LEVELS } from "../../integrations/connections/ConnectionStatus.js";

export { CONNECTION_STATUSES };

function safeArray(v) {
  return Array.isArray(v) ? v : [];
}

/**
 * Builds truthful connected-system snapshot from canonical ConnectionRuntime facts.
 */
export function buildConnectedSystemsSnapshot({ installationResult, connectionRuntime } = {}) {
  const requirements = safeArray(installationResult?.connectedSystemRequirements);
  const guidance = safeArray(installationResult?.connectionGuidance);
  const runtimeConnections = connectionRuntime?.getConnections?.() ?? [];

  const connections = requirements.map((req) => {
    const id = String(req.id ?? "");
    const guide = guidance.find((g) => String(g.id) === id) ?? {};
    const runtimeConn = runtimeConnections.find((c) => c.connectionType === id) ?? null;
    const status = runtimeConn?.status ?? CONNECTION_STATUSES.NOT_CONNECTED;
    const health = runtimeConn ? buildConnectionHealth(runtimeConn) : { level: CONNECTION_HEALTH_LEVELS.DISCONNECTED };

    return deepFreeze({
      id,
      connectionId: runtimeConn?.id ?? null,
      displayName: String(req.displayName ?? guide.displayName ?? id),
      requirementLevel: String(req.requirementLevel ?? guide.requirementLevel ?? "optional"),
      status,
      health,
      providerType: runtimeConn?.providerType ?? null,
      providerSelected: Boolean(runtimeConn?.providerType),
      connectionLabel:
        runtimeConn?.providerType?.startsWith("provider_mock") && status === CONNECTION_STATUSES.CONNECTED
          ? "Demo connection active"
          : status === CONNECTION_STATUSES.CONNECTED
            ? "Connected"
            : status === CONNECTION_STATUSES.NOT_CONNECTED
              ? "Not connected"
              : "Production setup required",
      purpose: String(guide.purpose ?? ""),
      enables: safeArray(guide.enables),
      blockedWithout: safeArray(guide.blockedWithout),
      lastVerifiedAt: runtimeConn?.lastVerifiedAt ?? null,
    });
  });

  const connected = connections.filter((c) => c.status === CONNECTION_STATUSES.CONNECTED).map((c) => c.id);
  const missingRequired = connections
    .filter((c) => c.requirementLevel === "required" && c.status !== CONNECTION_STATUSES.CONNECTED)
    .map((c) => c.id);

  return deepFreeze({
    connected: deepFreeze(connected),
    missingRequired: deepFreeze(missingRequired),
    connections,
  });
}
