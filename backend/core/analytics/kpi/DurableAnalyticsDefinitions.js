import { AnalyticsEngine } from "./AnalyticsEngine.js";
import { AnalyticsDefinitionStore } from "./AnalyticsDefinitionStore.js";

/**
 * Load tenant-scoped analytics definitions from Postgres.
 * Calculated metric values are never persisted — only definitions/targets/reports/selections/preferences.
 */
export async function loadAnalyticsEngineForBusiness(platformStore, businessId) {
  const row = await platformStore.getBusinessAnalyticsDefinitions?.(businessId);
  const store = new AnalyticsDefinitionStore({ seed: row?.payload ?? null });
  return new AnalyticsEngine({ store });
}

/**
 * Persist definition snapshot for a business (restart / multi-instance safe).
 */
export async function persistAnalyticsDefinitions(platformStore, businessId, engineOrSnapshot) {
  const payload = typeof engineOrSnapshot?.snapshotDefinitions === "function"
    ? engineOrSnapshot.snapshotDefinitions()
    : engineOrSnapshot;
  return platformStore.upsertBusinessAnalyticsDefinitions({
    businessId: String(businessId),
    payload: payload ?? {},
  });
}

/**
 * Collect live evidence bags from an authorized WorkspaceService + platformStore.
 * Missing sources stay undefined so calculators return insufficient_data — not fake zeros.
 *
 * @param {any} service
 * @param {{
 *   knowledgeDocumentCount?: number,
 *   memberCount?: number,
 *   asOf?: string,
 * }} [options]
 */
export function collectLiveAnalyticsEvidence(service, {
  knowledgeDocumentCount,
  memberCount,
  asOf = new Date().toISOString(),
} = {}) {
  const workVm = typeof service?.loadWorkViewModel === "function" ? service.loadWorkViewModel() : null;
  const workItems = Array.isArray(workVm?.items)
    ? workVm.items
    : Array.isArray(workVm?.workItems)
      ? workVm.workItems
      : [];

  const approvals = extractApprovals(service, workVm);
  const integrations = extractIntegrations(service);
  const communications = extractCommunications(service);
  const readiness = extractReadiness(service);

  return {
    asOf,
    workItems,
    approvals,
    integrations,
    communications,
    readiness,
    knowledgeDocumentCount,
    memberCount,
  };
}

function extractApprovals(service, workVm) {
  const fromWork = Array.isArray(workVm?.pendingApprovals) ? workVm.pendingApprovals : [];
  if (fromWork.length) {
    return fromWork.map((entry, index) => ({
      id: entry.id ?? `approval_${index}`,
      label: entry.title ?? entry.label ?? entry.id,
      status: entry.status ?? "pending",
    }));
  }

  try {
    const automation = typeof service?.loadAutomationCenterViewModel === "function"
      ? service.loadAutomationCenterViewModel()
      : null;
    const pending = Number(automation?.summary?.pendingApprovals ?? 0);
    if (pending > 0) {
      return Array.from({ length: pending }, (_, index) => ({
        id: `auto_approval_${index}`,
        label: "Automation awaiting approval",
        status: "pending",
      }));
    }
    if (automation?.summary && "pendingApprovals" in automation.summary) {
      return [];
    }
  } catch {
    // leave undefined
  }
  return fromWork.length ? fromWork : [];
}

function extractIntegrations(service) {
  try {
    const connections = typeof service?.loadConnectionCenterViewModel === "function"
      ? service.loadConnectionCenterViewModel()
      : null;
    const systems = Array.isArray(connections?.systems)
      ? connections.systems
      : Array.isArray(connections?.providers)
        ? connections.providers
        : Array.isArray(connections?.integrations)
          ? connections.integrations
          : [];
    if (systems.length) {
      return systems.map((entry, index) => ({
        id: entry.id ?? entry.providerId ?? `integration_${index}`,
        providerId: entry.providerId ?? entry.id,
        label: entry.label ?? entry.name ?? entry.providerId,
        health: entry.health ?? entry.status ?? entry.connectionStatus ?? "unknown",
      }));
    }
    const setup = typeof service?.loadSetupViewModel === "function" ? service.loadSetupViewModel() : null;
    const snapshot = setup?.connectedSystems ?? setup?.systems ?? [];
    if (Array.isArray(snapshot) && snapshot.length) {
      return snapshot.map((entry, index) => ({
        id: entry.id ?? `system_${index}`,
        providerId: entry.providerId ?? entry.id,
        label: entry.label ?? entry.name,
        health: entry.health ?? entry.status ?? "unknown",
      }));
    }
    return [];
  } catch {
    return [];
  }
}

function extractCommunications(service) {
  try {
    const inbox = typeof service?.loadCommunicationViewModel === "function"
      ? service.loadCommunicationViewModel({ includeProductContext: false })
      : null;
    const threads = Array.isArray(inbox?.threads)
      ? inbox.threads
      : Array.isArray(inbox?.messages)
        ? inbox.messages
        : [];
    return threads.map((entry, index) => ({
      id: entry.id ?? `comm_${index}`,
      label: entry.subject ?? entry.label ?? entry.id,
      status: entry.status ?? "open",
    }));
  } catch {
    return [];
  }
}

function extractReadiness(service) {
  try {
    const setup = typeof service?.loadSetupViewModel === "function" ? service.loadSetupViewModel() : null;
    return {
      score: setup?.readinessReport?.score ?? setup?.readiness?.score ?? null,
      status: setup?.readinessReport?.status ?? setup?.readiness?.status ?? null,
      blockers: setup?.readinessReport?.blockers ?? setup?.readiness?.blockers ?? [],
    };
  } catch {
    return null;
  }
}
