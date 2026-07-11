/**
 * Pure Integrations workspace projection — no React.
 * Prefers hub model / Business OS mapping; falls back to connection center rows.
 *
 * @param {{
 *   configuration?: Record<string, any> | null,
 *   integrationModel?: Record<string, any> | null,
 *   businessOsMapping?: Record<string, any> | null,
 *   connectionCenter?: Record<string, any> | null,
 * }} [args]
 */
export function composeIntegrationView({
  configuration = null,
  integrationModel = null,
  businessOsMapping = null,
  connectionCenter = null,
} = {}) {
  function asArray(value) {
    return Array.isArray(value) ? value : [];
  }

  const mapping = businessOsMapping ?? configuration?.integrations ?? null;
  const model = integrationModel ?? null;

  const connections = model?.connections?.length
    ? model.connections.map((connection) => ({
      id: String(connection.connectionId),
      providerId: String(connection.providerId),
      label: String(connection.label),
      category: String(connection.category ?? "generic"),
      status: String(connection.health?.statusId ?? "disconnected"),
      authMethod: String(connection.authMethod ?? "api_key"),
      capabilities: asArray(connection.capabilities),
      lastSyncAt: connection.lastSyncAt ?? null,
      setupGuide: connection.setupGuide ?? "",
      permissions: asArray(connection.permissions),
      errorHistory: asArray(connection.errorHistory),
      logs: asArray(connection.logs),
      rateLimitPerMinute: connection.rateLimitPerMinute ?? null,
      recommended: Boolean(connection.recommended),
    }))
    : asArray(mapping?.integrationRequirements ?? connectionCenter?.requirements).map((entry, index) => ({
      id: String(entry.requirementId ?? entry.id ?? `req_${index}`),
      providerId: String(entry.providerId ?? entry.providerType ?? entry.id ?? `provider_${index}`),
      label: String(entry.label ?? entry.providerId ?? "Integration"),
      category: String(entry.category ?? "generic"),
      status: String(entry.status ?? entry.health?.level ?? "disconnected").toLowerCase(),
      authMethod: String(entry.authMethod ?? "oauth2"),
      capabilities: asArray(entry.capabilities),
      lastSyncAt: entry.lastSyncAt ?? null,
      setupGuide: entry.setupGuide ?? entry.guidance ?? "",
      permissions: asArray(entry.permissions),
      errorHistory: [],
      logs: [],
      rateLimitPerMinute: null,
      recommended: true,
    }));

  const hasIntegrations = connections.length > 0;

  return {
    hasIntegrations,
    connections,
    healthSummary: {
      connected: connections.filter((entry) => entry.status === "connected").length,
      needsAttention: connections.filter((entry) => /attention|syncing|paused|degraded/.test(entry.status)).length,
      disconnected: connections.filter((entry) => /disconnect|not_connected/.test(entry.status)).length,
      error: connections.filter((entry) => entry.status === "error").length,
    },
    capabilities: asArray(mapping?.capabilityRequirements).map((entry) => ({
      id: String(entry.capabilityId),
      label: String(entry.label ?? entry.capabilityId),
      providers: asArray(entry.satisfiedBy),
    })),
    syncHistory: connections
      .filter((entry) => entry.lastSyncAt)
      .map((entry) => ({
        id: `sync_${entry.id}`,
        label: entry.label,
        detail: String(entry.lastSyncAt),
      })),
    logs: connections.flatMap((entry) => (
      entry.logs.map((log, index) => ({
        id: `log_${entry.id}_${index}`,
        label: entry.label,
        detail: String(log.message ?? log),
      }))
    )),
    metrics: [
      { id: "connections", label: "Connections", value: connections.length },
      { id: "connected", label: "Connected", value: connections.filter((entry) => entry.status === "connected").length },
      { id: "attention", label: "Needs attention", value: connections.filter((entry) => entry.status === "needs_attention").length },
      { id: "capabilities", label: "Capabilities", value: asArray(mapping?.capabilityRequirements).length || connections.reduce((sum, entry) => sum + entry.capabilities.length, 0) },
    ],
  };
}
