import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";
import { CONNECTION_STATUSES } from "../../industries/connections/buildConnectedSystemsSnapshot.js";
import { buildConnectionHealth } from "../../integrations/health/ConnectionHealthEngine.js";

function safeArray(v) {
  return Array.isArray(v) ? v : [];
}

export function buildConnectionCenterViewModel({
  identity,
  installationResult,
  connectedSystemsSnapshot,
  connectionDependencyProjection,
  providerRegistry,
} = {}) {
  const requirements = safeArray(installationResult?.connectedSystemRequirements);
  const guidance = safeArray(installationResult?.connectionGuidance);
  const snapshotConnections = safeArray(connectedSystemsSnapshot?.connections);
  const dependencyByType = new Map(
    safeArray(connectionDependencyProjection?.connections).map((d) => [d.connectionType, d]),
  );

  const connections = requirements.map((req) => {
    const id = String(req.id ?? "");
    const guide = guidance.find((g) => String(g.id) === id) ?? {};
    const snapshot = snapshotConnections.find((c) => String(c.id) === id) ?? null;
    const status = snapshot?.status ?? CONNECTION_STATUSES.NOT_CONNECTED;
    const health = snapshot?.health ?? buildConnectionHealth(null);
    const dependency = dependencyByType.get(id) ?? null;
    const providerType = snapshot?.providerType ?? null;
    const provider = providerType && providerRegistry ? providerRegistry.getProvider(providerType) : null;
    const providerGuidance = provider?.getSetupGuidance?.() ?? null;

    const availableActions = [];
    if (status === CONNECTION_STATUSES.NOT_CONNECTED && provider) {
      availableActions.push({ id: "configure", label: "Configure", supported: true });
    } else if (status === CONNECTION_STATUSES.CONFIGURING) {
      availableActions.push({ id: "verify", label: "Verify", supported: true });
    } else if (status === CONNECTION_STATUSES.CONNECTED) {
      availableActions.push({ id: "reconnect", label: "Reconnect", supported: false, reason: "Setup not yet available in-app" });
    } else {
      availableActions.push({ id: "connect", label: "Connect", supported: false, reason: "Setup not yet available in-app" });
    }

    return deepFreeze({
      id,
      connectionId: snapshot?.connectionId ?? null,
      displayName: String(req.displayName ?? guide.displayName ?? id),
      purpose: String(guide.purpose ?? providerGuidance?.summary ?? ""),
      requirementLevel: String(req.requirementLevel ?? guide.requirementLevel ?? "optional"),
      status,
      health,
      enables: dependency?.enables ?? deepFreeze({ capabilities: [], employees: [], automations: [], communicationIntents: [] }),
      blockedWithout: dependency?.blockedWithout ?? deepFreeze({ capabilities: [], employees: [], automations: [], communicationIntents: [] }),
      setupInstructions: String(providerGuidance?.steps?.join(" ") ?? guide.setupInstructions ?? "Provider-specific setup will appear when a provider is selected."),
      verificationInstructions: String(providerGuidance?.verificationMethod ?? guide.verificationInstructions ?? ""),
      troubleshootingGuidance: String(providerGuidance?.commonProblems?.join(" ") ?? guide.troubleshootingGuidance ?? ""),
      requiredPermissions: safeArray(providerGuidance?.permissionsRequested ?? guide.requiredPermissions),
      estimatedSetupComplexity: String(guide.estimatedSetupComplexity ?? providerGuidance?.estimatedTime ?? "unknown"),
      providerSelected: Boolean(providerType),
      providerName: provider?.displayName ?? null,
      providerType,
      availableActions: deepFreeze(availableActions),
    });
  });

  const attention = connections
    .filter((c) => {
      if (c.requirementLevel === "required" && c.status !== CONNECTION_STATUSES.CONNECTED) return true;
      if (c.health?.level === "ERROR" || c.health?.level === "NEEDS_ATTENTION") return true;
      return false;
    })
    .map((c) => ({
      id: `attention_${c.id}`,
      title: c.status !== CONNECTION_STATUSES.CONNECTED ? `${c.displayName} is not connected` : `${c.displayName} needs attention`,
      detail: c.blockedWithout?.employees?.length
        ? `Blocked employees: ${c.blockedWithout.employees.map((e) => e.name ?? e.id).join(", ")}`
        : c.purpose,
      priority: c.requirementLevel === "required" ? "immediate" : "soon",
    }));

  return deepFreeze({
    title: identity?.pageLabels?.connectionsPageTitle ?? "Connections",
    connections: deepFreeze(connections),
    summary: deepFreeze({
      total: connections.length,
      connected: connections.filter((c) => c.status === CONNECTION_STATUSES.CONNECTED).length,
      requiredMissing: connections.filter((c) => c.requirementLevel === "required" && c.status !== CONNECTION_STATUSES.CONNECTED).length,
      degraded: connections.filter((c) => c.health?.level === "NEEDS_ATTENTION" || c.health?.level === "ERROR").length,
    }),
    attention: deepFreeze(attention),
    recommendedNextStep:
      attention[0]?.title ?? (connections.length ? "Review optional integrations when core operations are stable." : "No connection requirements for this workspace."),
  });
}

export class ConnectionCenterViewAdapter {
  translate(input = {}) {
    return buildConnectionCenterViewModel(input);
  }
}
