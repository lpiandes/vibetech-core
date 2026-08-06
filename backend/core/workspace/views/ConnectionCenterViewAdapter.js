import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";
import { CONNECTION_STATUSES } from "../../industries/connections/buildConnectedSystemsSnapshot.js";
import { buildConnectionHealth } from "../../integrations/health/ConnectionHealthEngine.js";

function safeArray(v) {
  return Array.isArray(v) ? v : [];
}

/** Map Business OS integration ids onto connection-center requirement ids. */
const OS_INTEGRATION_TO_CONNECTION = Object.freeze({
  business_email: "business_email",
  email: "business_email",
  gmail: "business_email",
  sms: "sms_channel",
  sms_channel: "sms_channel",
  voice: "voice_channel",
  voice_channel: "voice_channel",
  phone: "voice_channel",
  calendar: "calendar",
  google_calendar: "calendar",
  accounting: "accounting",
  document_storage: "document_storage",
  documents: "document_storage",
  property_management_system: "property_management_system",
  pms: "property_management_system",
  meta_lead_ads: "meta_lead_ads",
  facebook: "meta_lead_ads",
  facebook_leads: "meta_lead_ads",
  social_screening: "social_screening",
  prospecting_enrichment: "prospecting_enrichment",
});

function normalizeRequirementEntry(entry) {
  const rawId = String(entry?.integrationId ?? entry?.id ?? "").toLowerCase();
  const id = OS_INTEGRATION_TO_CONNECTION[rawId] ?? rawId;
  if (!id) return null;
  const status = String(entry?.status ?? "required").toLowerCase();
  if (status === "deferred" || status === "not_yet" || status === "prohibited") {
    return null;
  }
  return {
    id,
    displayName: String(entry?.label ?? entry?.displayName ?? id.replace(/_/g, " ")),
    requirementLevel: status === "optional" || status === "recommended" ? status : "required",
  };
}

/**
 * Teammate connectionDependencies (e.g. RFT needs calendar) must surface even
 * when discovery only listed email — otherwise Connections can't offer the gap.
 */
export function connectionRequirementsFromEmployees(employees = []) {
  const byId = new Map();
  for (const emp of safeArray(employees)) {
    const deps = safeArray(
      emp?.connectionDependencies
      ?? emp?.operatingContract?.rules?.connectionDependencies,
    );
    for (const raw of deps) {
      const rawId = String(raw ?? "").toLowerCase();
      const id = OS_INTEGRATION_TO_CONNECTION[rawId] ?? rawId;
      if (!id || byId.has(id)) continue;
      byId.set(id, {
        id,
        displayName: id.replace(/_/g, " "),
        requirementLevel: "required",
      });
    }
  }
  return [...byId.values()];
}

/**
 * Prefer Business OS integration plan when present.
 * Merge employee connectionDependencies so runtime needs aren't orphaned.
 * Fall back to industry-package connectedSystemRequirements.
 * Never invent rows from the frontend display catalog alone.
 */
export function resolveConnectionRequirements({
  installationResult = null,
  businessOsIntegrations = null,
  employees = null,
} = {}) {
  const byId = new Map();

  for (const entry of safeArray(businessOsIntegrations)) {
    const normalized = normalizeRequirementEntry(entry);
    if (normalized) byId.set(normalized.id, normalized);
  }

  const employeeList = safeArray(
    employees
    ?? installationResult?.configuration?.employees
    ?? installationResult?.employees,
  );
  for (const req of connectionRequirementsFromEmployees(employeeList)) {
    if (!byId.has(req.id)) byId.set(req.id, req);
  }

  if (byId.size) return [...byId.values()];

  return safeArray(installationResult?.connectedSystemRequirements).map((req) => ({
    id: String(req.id ?? ""),
    displayName: String(req.displayName ?? req.id ?? ""),
    requirementLevel: String(req.requirementLevel ?? "optional"),
  })).filter((req) => req.id);
}

function buildUnlockMessage(connectionId, status) {
  if (String(status) !== CONNECTION_STATUSES.CONNECTED) {
    return null;
  }
  const id = String(connectionId);
  if (id === "business_email" || id === "email") {
    return "Email connected → teammates can draft/send (with approval).";
  }
  if (id === "calendar") {
    return "Calendar connected → Work due dates and tours can sync.";
  }
  if (id === "sms_channel" || id === "sms") {
    return "SMS connected → teammates can draft texts (with approval).";
  }
  if (id === "voice_channel" || id === "voice") {
    return "Voice connected → call intents still require approval.";
  }
  if (id === "meta_lead_ads") {
    return "Meta connected → leads import as Work, not spreadsheets.";
  }
  if (id === "document_storage") {
    return "Document storage connected → import into Knowledge (VIBETech remains SoT).";
  }
  if (id === "accounting") {
    return "Accounting connected → Memory facts only; ledger stays in your SoR.";
  }
  return "Connection healthy. Credentials survive process restart via durable vault.";
}

export function buildConnectionCenterViewModel({
  identity,
  installationResult,
  connectedSystemsSnapshot,
  connectionDependencyProjection,
  providerRegistry,
  businessOsIntegrations = null,
  employees = null,
} = {}) {
  const requirements = resolveConnectionRequirements({
    installationResult,
    businessOsIntegrations,
    employees,
  });
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
      const needsReconnect =
        health?.level === "ERROR"
        || health?.level === "NEEDS_ATTENTION"
        || health?.level === "DISCONNECTED";
      availableActions.push({
        id: "reconnect",
        label: needsReconnect ? "Reconnect" : "Reconnect",
        supported: Boolean(provider),
        reason: provider ? null : "Setup not yet available in-app",
      });
      if (needsReconnect) {
        availableActions.push({
          id: "review_health",
          label: "Health details",
          supported: true,
        });
      }
    } else {
      availableActions.push({
        id: "reconnect",
        label: "Reconnect",
        supported: Boolean(provider),
        reason: provider ? null : "Setup not yet available in-app",
      });
    }

    return deepFreeze({
      id,
      connectionId: snapshot?.connectionId ?? null,
      displayName: String(req.displayName ?? guide.displayName ?? id),
      purpose: String(guide.purpose ?? providerGuidance?.summary ?? ""),
      requirementLevel: String(req.requirementLevel ?? guide.requirementLevel ?? "optional"),
      status,
      health,
      healthLabel: health?.label ?? health?.level ?? null,
      healthDetail: health?.message ?? health?.detail ?? providerGuidance?.reconnectInstructions ?? null,
      unlockMessage: buildUnlockMessage(id, status),
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
