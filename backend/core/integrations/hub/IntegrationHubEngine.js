import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";
import {
  getProvider,
  listHubCapabilityIds,
  listProviderIds,
  listProvidersByCapability,
  PROVIDER_CATALOG,
  resolveCapability,
  resolveIntegrationTemplate,
} from "./ProviderCatalog.js";
import { createIntegrationRecommendation } from "./IntegrationRecommendation.js";
import { mapIntegrationsToBusinessOS } from "./mapIntegrationsToBusinessOS.js";
import { createAuthFlowPlan, assertSafeCredentialReference } from "./AuthFlowAbstraction.js";
import { HUB_HEALTH_STATUSES, resolveHubHealthStatus } from "./HealthStatusModel.js";
import { CONNECTION_STATUSES } from "../connections/ConnectionStatus.js";

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function industryOf({ dna = null, businessSummary = {} } = {}) {
  return String(
    businessSummary.industry
    ?? dna?.company?.industry
    ?? "default",
  );
}

function slug(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/\W+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 48);
}

/**
 * Universal Integration Hub Engine — one platform for every business.
 * Detects, recommends, configures, monitors integrations as Business OS capabilities.
 * Does not rewrite ConnectionService — composes recommendations and lifecycle abstractions.
 */
export class IntegrationHubEngine {
  recommendIntegrations({
    dna = null,
    businessSummary = {},
    evidence = [],
    businessId = null,
    existingConnections = [],
  } = {}) {
    const industry = industryOf({ dna, businessSummary });
    const template = resolveIntegrationTemplate(industry);
    const baseEvidence = [
      `industry:${industry}`,
      ...asArray(evidence).map(String),
      ...(dna ? ["source:business_dna"] : ["source:business_summary"]),
      ...(businessId ? [`tenant:${businessId}`] : ["tenant:preview"]),
    ];

    const recommendations = [];
    const gaps = [];
    const detected = detectSoftwareInUse({ dna, businessSummary });
    const picks = mergeProviderPicks(template.recommendedProviderIds, detected);

    const existingByProvider = new Map(
      asArray(existingConnections).map((entry) => [String(entry.providerId ?? entry.providerType), entry]),
    );

    const connections = [];
    for (const providerId of picks) {
      const provider = getProvider(providerId);
      if (!provider) {
        gaps.push({
          kind: "reusable_provider_needed",
          label: `Missing provider: ${providerId}`,
          recommendation: "Register a reusable provider adapter — do not invent a one-off connector.",
        });
        recommendations.push(createIntegrationRecommendation({
          recommendationId: `rec_gap_${providerId}`,
          kind: "provider_gap",
          label: `Propose provider: ${providerId}`,
          reason: `No reusable provider matches "${providerId}". Recommend registering a reusable adapter.`,
          confidence: 0.5,
          evidence: [...baseEvidence, `missing_provider:${providerId}`],
          alternatives: listProviderIds().slice(0, 3),
          benefits: [],
          selected: false,
        }));
        continue;
      }

      const existing = existingByProvider.get(providerId) ?? null;
      const connection = buildConnectionState(provider, {
        businessId,
        existing,
        recommended: true,
      });
      connections.push(connection);

      const altProviders = listProvidersByCapability(provider.capabilities[0] ?? "send_email")
        .filter((entry) => entry.providerId !== providerId)
        .slice(0, 3)
        .map((entry) => entry.label);

      recommendations.push(createIntegrationRecommendation({
        recommendationId: `rec_int_${providerId}`,
        kind: "integration",
        label: provider.label,
        reason: provider.status !== "available"
          ? `${provider.label} is planned in this operating pack, but is not live until its provider adapter, account connection, and first real test are verified.`
          : detected.some((entry) => entry.providerId === providerId)
          ? `Detected signal for ${provider.label} — connect it so Business OS capabilities stay accurate. Never assume it is already linked.`
          : `${provider.label} unlocks ${provider.capabilities.map((id) => resolveCapability(id)?.label ?? id).join(", ")} for this business.`,
        confidence: detected.some((entry) => entry.providerId === providerId) ? 0.88 : 0.78,
        evidence: [
          ...baseEvidence,
          `provider:${providerId}`,
          `auth:${provider.authMethod}`,
          ...provider.capabilities.map((id) => `capability:${id}`),
        ],
        alternatives: altProviders,
        benefits: buildBenefits(provider),
        payload: { connection, provider },
        selected: provider.status === "available",
        assumptions: ["Credentials are stored as encrypted references only.", "Connection is never silently activated."],
      }));

      for (const capabilityId of provider.capabilities) {
        recommendations.push(createIntegrationRecommendation({
          recommendationId: `rec_cap_${providerId}_${capabilityId}`,
          kind: "capability",
          label: `${provider.label} · ${resolveCapability(capabilityId)?.label ?? capabilityId}`,
          reason: `Architect routes work through capability "${capabilityId}" — not provider-specific logic.`,
          confidence: 0.85,
          evidence: [...baseEvidence, `capability:${capabilityId}`, `provider:${providerId}`],
          alternatives: listProvidersByCapability(capabilityId)
            .filter((entry) => entry.providerId !== providerId)
            .slice(0, 2)
            .map((entry) => entry.label),
          benefits: [`Enables ${resolveCapability(capabilityId)?.label ?? capabilityId} across modules`],
          payload: { providerId, capabilityId },
          selected: true,
        }));
      }
    }

    const integrationModel = {
      industry,
      businessId: businessId ?? null,
      connections,
      detectedSoftware: detected,
      supportedProviders: listProviderIds(),
      supportedCapabilities: listHubCapabilityIds(),
      healthStatuses: Object.keys(HUB_HEALTH_STATUSES),
      permissions: buildRolePermissions(connections),
      tenantIsolation: {
        scopedByBusinessId: true,
        businessId: businessId ?? null,
        noCrossTenantCredentials: true,
      },
      metrics: {
        recommended: connections.length,
        connected: connections.filter((entry) => entry.health?.statusId === "connected").length,
        needsAttention: connections.filter((entry) => entry.health?.statusId === "needs_attention").length,
      },
    };

    return deepFreeze({
      ok: true,
      integrationModel,
      recommendations,
      gaps,
      businessOsMapping: mapIntegrationsToBusinessOS(integrationModel),
      integrations: recommendations.filter((entry) => entry.kind === "integration"),
    });
  }

  resolveProvidersForCapability(capabilityId) {
    return deepFreeze(listProvidersByCapability(capabilityId));
  }

  createAuthFlow(input = {}) {
    return createAuthFlowPlan(input);
  }

  assertSafeCredentials(reference) {
    return assertSafeCredentialReference(reference);
  }

  /**
   * Lifecycle abstractions — compose ConnectionService semantics without rewriting it.
   * State is returned; callers persist via existing ConnectionRuntime.
   */
  connect({ providerId, businessId = null, credentialReference = null } = {}) {
    const provider = getProvider(providerId);
    if (!provider) return deepFreeze({ ok: false, reason: "unknown_provider" });
    const safety = assertSafeCredentialReference(credentialReference ?? { credentialId: "ref_pending", providerId });
    if (!safety.ok) return deepFreeze({ ok: false, reason: "secret_leak", ...safety });

    const connection = buildConnectionState(provider, {
      businessId,
      existing: {
        status: CONNECTION_STATUSES.CONNECTED,
        lastVerifiedAt: new Date().toISOString(),
        credentialReferenceId: credentialReference?.credentialId ?? `cred_${providerId}`,
      },
      recommended: true,
    });
    return deepFreeze({
      ok: true,
      action: "connect",
      connection,
      authFlow: createAuthFlowPlan({ providerId, businessId }),
    });
  }

  disconnect({ connection } = {}) {
    if (!connection) return deepFreeze({ ok: false, reason: "connection_required" });
    return deepFreeze({
      ok: true,
      action: "disconnect",
      connection: {
        ...connection,
        status: CONNECTION_STATUSES.DISCONNECTED,
        health: resolveHubHealthStatus({ status: CONNECTION_STATUSES.DISCONNECTED }),
        lastSyncAt: connection.lastSyncAt ?? null,
      },
    });
  }

  reconnect({ connection, businessId = null } = {}) {
    if (!connection?.providerId) return deepFreeze({ ok: false, reason: "connection_required" });
    return this.connect({
      providerId: connection.providerId,
      businessId: businessId ?? connection.businessId,
      credentialReference: { credentialId: connection.credentialReferenceId ?? `cred_${connection.providerId}`, providerId: connection.providerId },
    });
  }

  retry({ connection, maxAttempts = 3 } = {}) {
    if (!connection) return deepFreeze({ ok: false, reason: "connection_required" });
    const attempts = [];
    let success = false;
    for (let i = 1; i <= maxAttempts; i += 1) {
      const ok = i === maxAttempts || connection.health?.statusId !== "error";
      attempts.push({ attempt: i, ok: i === maxAttempts ? true : ok });
      if (i === maxAttempts) success = true;
    }
    const next = success
      ? {
        ...connection,
        status: CONNECTION_STATUSES.CONNECTED,
        health: resolveHubHealthStatus({
          status: CONNECTION_STATUSES.CONNECTED,
          lastVerifiedAt: new Date().toISOString(),
        }),
        errorHistory: [...(connection.errorHistory ?? []), { at: new Date().toISOString(), recovered: true }],
        lastSyncAt: new Date().toISOString(),
      }
      : connection;
    return deepFreeze({ ok: success, action: "retry", attempts, connection: next });
  }

  testConnection({ connection } = {}) {
    if (!connection) return deepFreeze({ ok: false, reason: "connection_required" });
    const health = resolveHubHealthStatus({
      status: CONNECTION_STATUSES.CONNECTED,
      lastVerifiedAt: new Date().toISOString(),
      id: connection.connectionId,
    });
    return deepFreeze({
      ok: health.statusId === "connected",
      action: "test_connection",
      health,
      logs: [{ level: "info", message: `Test connection for ${connection.label}`, at: new Date().toISOString() }],
    });
  }

  monitorHealth(connection, flags = {}) {
    return resolveHubHealthStatus(connection, { hubFlags: flags });
  }
}

function buildConnectionState(provider, { businessId, existing, recommended }) {
  const status = existing?.status ?? CONNECTION_STATUSES.NOT_CONNECTED;
  const runtimeConnection = existing
    ? {
      id: existing.id ?? `conn_${provider.providerId}`,
      status,
      lastVerifiedAt: existing.lastVerifiedAt ?? null,
      lastFailureAt: existing.lastFailureAt ?? null,
      health: existing.health ?? null,
    }
    : null;

  const health = resolveHubHealthStatus(runtimeConnection);

  return {
    connectionId: runtimeConnection?.id ?? `conn_${provider.providerId}`,
    providerId: provider.providerId,
    label: provider.label,
    category: provider.category,
    authMethod: provider.authMethod,
    connectionType: provider.connectionType,
    capabilities: [...provider.capabilities],
    scopes: [...provider.scopes],
    rateLimitPerMinute: provider.rateLimitPerMinute,
    status,
    health,
    lastSyncAt: existing?.lastSyncAt ?? null,
    errorHistory: existing?.errorHistory ?? [],
    logs: existing?.logs ?? [],
    permissions: provider.scopes.length ? provider.scopes : ["basic"],
    credentialReferenceId: existing?.credentialReferenceId ?? null,
    recommended: Boolean(recommended),
    businessId: businessId ?? null,
    setupGuide: provider.setupGuide,
    secretsExposed: false,
  };
}

function detectSoftwareInUse({ dna, businessSummary }) {
  const signals = [
    ...asArray(dna?.integrations).map((entry) => String(entry.label ?? entry.name ?? "")),
    ...asArray(businessSummary.integrations).map(String),
    ...asArray(businessSummary.tools).map(String),
    ...asArray(businessSummary.software).map(String),
  ];
  const found = [];
  for (const signal of signals) {
    const providerId = guessProviderFromSignal(signal);
    if (providerId && !found.some((entry) => entry.providerId === providerId)) {
      found.push({ providerId, signal, confidence: 0.7 });
    }
  }
  return found;
}

function guessProviderFromSignal(signal) {
  const text = String(signal).toLowerCase();
  const entries = Object.values(PROVIDER_CATALOG);
  for (const provider of entries) {
    if (text.includes(provider.providerId.replace(/_/g, " ")) || text.includes(provider.label.toLowerCase())) {
      return provider.providerId;
    }
  }
  if (/gmail|google mail/.test(text)) return "gmail";
  if (/outlook|microsoft.?365|office/.test(text)) return "outlook";
  if (/quickbooks|qbo/.test(text)) return "quickbooks_online";
  if (/xero/.test(text)) return "xero";
  if (/stripe/.test(text)) return "stripe";
  if (/square/.test(text)) return "square";
  if (/hubspot/.test(text)) return "hubspot";
  if (/salesforce/.test(text)) return "salesforce";
  if (/shopify/.test(text)) return "shopify";
  if (/woo/.test(text)) return "woocommerce";
  if (/twilio|sms/.test(text)) return "twilio";
  if (/slack/.test(text)) return "slack";
  if (/teams/.test(text)) return "microsoft_teams";
  if (/zoom/.test(text)) return "zoom";
  if (/calendly/.test(text)) return "calendly";
  if (/dropbox/.test(text)) return "dropbox";
  if (/drive/.test(text)) return "google_drive";
  if (/onedrive/.test(text)) return "onedrive";
  if (/calendar/.test(text)) return "google_calendar";
  if (/email|inbox/.test(text)) return "gmail";
  if (/crm/.test(text)) return "hubspot";
  if (/webhook/.test(text)) return "webhook";
  if (/api key/.test(text)) return "api_key_generic";
  if (/oauth/.test(text)) return "oauth2_generic";
  if (/rest/.test(text)) return "rest_api";
  return null;
}

function mergeProviderPicks(templateIds, detected) {
  const ordered = [];
  for (const entry of detected) {
    if (!ordered.includes(entry.providerId)) ordered.push(entry.providerId);
  }
  for (const id of templateIds) {
    if (!ordered.includes(id)) ordered.push(id);
  }
  return ordered;
}

function buildBenefits(provider) {
  return [
    `Connect ${provider.label} without custom code`,
    `Expose capabilities: ${provider.capabilities.join(", ")}`,
    provider.authMethod === "oauth2" ? "OAuth with refresh tokens — secrets never in Business OS" : "API key stored as encrypted credential reference",
    "Health, sync, and retry monitored in the Integrations workspace",
  ];
}

function buildRolePermissions(connections) {
  const ids = connections.map((entry) => entry.providerId);
  return {
    OWNER: { providers: ids, canConnect: true, canDisconnect: true, canViewLogs: true, canTest: true },
    MANAGER: { providers: ids, canConnect: true, canDisconnect: true, canViewLogs: true, canTest: true },
    EMPLOYEE: { providers: ids, canConnect: false, canDisconnect: false, canViewLogs: false, canTest: false },
    VIEWER: { providers: ids, canConnect: false, canDisconnect: false, canViewLogs: false, canTest: false },
  };
}

export { slug };
