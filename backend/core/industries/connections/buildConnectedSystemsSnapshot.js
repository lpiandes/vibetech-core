import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";
import { CONNECTION_STATUSES } from "../../integrations/connections/ConnectionStatus.js";
import { buildConnectionHealth } from "../../integrations/health/ConnectionHealthEngine.js";
import { CONNECTION_HEALTH_LEVELS } from "../../integrations/connections/ConnectionStatus.js";

export { CONNECTION_STATUSES };

function safeArray(v) {
  return Array.isArray(v) ? v : [];
}

function connectionRow({ id, req = {}, guide = {}, runtimeConn = null }) {
  const status = runtimeConn?.status ?? CONNECTION_STATUSES.NOT_CONNECTED;
  const health = runtimeConn ? buildConnectionHealth(runtimeConn) : { level: CONNECTION_HEALTH_LEVELS.DISCONNECTED };

  const metadata = runtimeConn?.metadata && typeof runtimeConn.metadata === "object"
    ? { ...runtimeConn.metadata }
    : {};

  return deepFreeze({
    id,
    connectionId: runtimeConn?.id ?? null,
    displayName: String(req.displayName ?? guide.displayName ?? id.replace(/_/g, " ")),
    requirementLevel: String(req.requirementLevel ?? guide.requirementLevel ?? "optional"),
    status,
    health,
    providerType: runtimeConn?.providerType ?? null,
    providerSelected: Boolean(runtimeConn?.providerType),
    metadata: deepFreeze(metadata),
    a2pRegistrationStatus: metadata.a2pRegistrationStatus ?? null,
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
}

/**
 * Builds truthful connected-system snapshot from canonical ConnectionRuntime facts.
 * Includes every live runtime connection — not only declared requirements —
 * so Business OS connects (calendar, SMS, …) surface on Home / Launch Center.
 */
export function buildConnectedSystemsSnapshot({ installationResult, connectionRuntime } = {}) {
  const requirements = safeArray(installationResult?.connectedSystemRequirements);
  const guidance = safeArray(installationResult?.connectionGuidance);
  const runtimeConnections = connectionRuntime?.getConnections?.() ?? [];
  const runtimeByType = new Map(
    runtimeConnections
      .map((c) => [String(c?.connectionType ?? ""), c])
      .filter(([id]) => Boolean(id)),
  );

  const byId = new Map();

  for (const req of requirements) {
    const id = String(req.id ?? "");
    if (!id) continue;
    const guide = guidance.find((g) => String(g.id) === id) ?? {};
    byId.set(
      id,
      connectionRow({
        id,
        req,
        guide,
        runtimeConn: runtimeByType.get(id) ?? null,
      }),
    );
  }

  for (const [id, runtimeConn] of runtimeByType) {
    if (byId.has(id)) continue;
    byId.set(
      id,
      connectionRow({
        id,
        req: { displayName: id.replace(/_/g, " "), requirementLevel: "optional" },
        runtimeConn,
      }),
    );
  }

  const connections = [...byId.values()];
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
