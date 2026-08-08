/**
 * Persist + resolve white-glove ops requests on business.packageConfiguration.pendingOpsRequests
 * and optionally installation.configuration.pendingOpsRequests.
 */
import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";
import {
  getWhiteGloveConnection,
  isWhiteGloveConnection,
  normalizeConnectionId,
} from "./WhiteGloveConnectionRegistry.js";
import { connectionStatusesFromCredentials } from "../credentials/connectionStatusesFromDurableCredentials.js";

export const OPS_STATUS = deepFreeze({
  PENDING: "pending_ops",
  READY: "ops_ready",
  CANCELLED: "cancelled",
});

function safeObj(v) {
  return v && typeof v === "object" && !Array.isArray(v) ? v : {};
}

export function isConnectionLiveStatus(raw) {
  const status = String(
    typeof raw === "object" && raw != null
      ? (raw.status ?? raw.state ?? "")
      : (raw ?? ""),
  ).toUpperCase();
  return status === "CONNECTED" || status === "VERIFIED" || status === "PROVEN" || status === "OK" || raw === true;
}

export function readPendingOpsRequests(packageConfiguration = null, installation = null) {
  const fromBiz = safeObj(packageConfiguration?.pendingOpsRequests);
  const fromInstall = safeObj(installation?.configuration?.pendingOpsRequests);
  return deepFreeze({ ...fromInstall, ...fromBiz });
}

/**
 * Resolve live connection statuses from durable credentials (+ optional overlay).
 */
export async function resolveBusinessConnectionStatuses({
  platformStore,
  businessId,
  overlay = {},
} = {}) {
  const rows = typeof platformStore?.listIntegrationCredentialsForWorkspace === "function"
    ? await platformStore.listIntegrationCredentialsForWorkspace(businessId).catch(() => [])
    : [];
  const fromCreds = connectionStatusesFromCredentials(Array.isArray(rows) ? rows : []);
  return deepFreeze({ ...fromCreds, ...safeObj(overlay) });
}

/**
 * Owner-facing phase for a white-glove connection.
 * @returns {"self_serve"|"request"|"pending"|"good_to_go"|"connected"}
 *
 * Connected (live credentials) always wins → owner can Test.
 * ops_ready without Connected should not happen after markWhiteGloveReady gates;
 * if it does, treat as good_to_go (refresh / wait).
 */
export function resolveWhiteGloveOwnerPhase({
  connectionId,
  connectionStatus = null,
  pendingOpsRequests = {},
} = {}) {
  const id = normalizeConnectionId(connectionId) ?? String(connectionId ?? "");
  if (!isWhiteGloveConnection(id)) return "self_serve";

  if (isConnectionLiveStatus(connectionStatus)) {
    return "connected";
  }

  const req = pendingOpsRequests?.[id] ?? pendingOpsRequests?.[String(connectionId)];
  const opsStatus = String(req?.status ?? "");
  if (opsStatus === OPS_STATUS.READY) return "good_to_go";
  if (opsStatus === OPS_STATUS.PENDING) return "pending";
  return "request";
}

export function buildPendingOpsRequest({
  connectionId,
  playbookId,
  steps = [],
  requestedBy = null,
  ownerInputs = {},
  integrationsHref = null,
  adminHref = null,
  nowISO = new Date().toISOString(),
  lastNotify = null,
} = {}) {
  const id = normalizeConnectionId(connectionId) ?? String(connectionId ?? "");
  const meta = getWhiteGloveConnection(id);
  return deepFreeze({
    status: OPS_STATUS.PENDING,
    connectionId: id,
    playbookId: String(playbookId ?? meta?.playbookId ?? ""),
    requestedAt: nowISO,
    requestedBy: requestedBy ? String(requestedBy) : null,
    ownerInputs: safeObj(ownerInputs),
    steps: Array.isArray(steps) ? steps.map(String) : [],
    integrationsHref,
    adminHref,
    ownerTitle: meta?.ownerTitle ?? id,
    ownerPendingCopy: meta?.ownerPendingCopy ?? "Hold on — VIBETech is setting this up for you.",
    ownerReadyCopy: meta?.ownerReadyCopy ?? "Good to go — you can continue setup.",
    readyAt: null,
    readyBy: null,
    lastNotify: lastNotify && typeof lastNotify === "object" ? lastNotify : null,
  });
}

export function markOpsRequestReady(existing, { actorId = "admin", nowISO = new Date().toISOString() } = {}) {
  if (!existing || typeof existing !== "object") return null;
  return deepFreeze({
    ...existing,
    status: OPS_STATUS.READY,
    readyAt: nowISO,
    readyBy: String(actorId),
  });
}

export function withOpsNotifyResult(existing, notifyResult = null) {
  if (!existing || typeof existing !== "object") return existing;
  const ok = notifyResult?.ok !== false && !notifyResult?.error;
  return deepFreeze({
    ...existing,
    lastNotify: {
      ok: Boolean(ok),
      at: new Date().toISOString(),
      skipped: Boolean(notifyResult?.skipped),
      reason: notifyResult?.reason ?? notifyResult?.error ?? null,
      error: notifyResult?.error ? String(notifyResult.error) : null,
    },
  });
}

/**
 * Connect steps incomplete while white-glove is still pending_ops or never requested.
 * OR semantics: if any listed connection is satisfied (live Connected, or
 * attested good_to_go when markReadyRequiresConnected is false), do not block.
 */
export function whiteGloveConnectionSatisfiesConnect({
  connectionId,
  connectionStatus = null,
  pendingOpsRequests = {},
} = {}) {
  const id = normalizeConnectionId(connectionId) ?? String(connectionId ?? "");
  if (!id) return false;
  if (isConnectionLiveStatus(connectionStatus)) return true;
  if (!isWhiteGloveConnection(id)) return false;
  const phase = resolveWhiteGloveOwnerPhase({
    connectionId: id,
    connectionStatus,
    pendingOpsRequests,
  });
  if (phase !== "good_to_go" && phase !== "connected") return false;
  const meta = getWhiteGloveConnection(id);
  // Attestation-only channels (e.g. Salesforce Custom Build) count without vault Connected.
  return meta?.markReadyRequiresConnected === false;
}

/**
 * Test step OR: real proof OR attestation-only channel marked ops_ready.
 * Used so Salesforce Custom Build can finish CRM package go-live without HubSpot proof.
 */
export function whiteGloveAttestationSatisfiesTest({
  connectionIds = [],
  connectionStatuses = {},
  pendingOpsRequests = {},
} = {}) {
  const ids = Array.isArray(connectionIds) ? connectionIds : [];
  return ids.some((rawId) => {
    const id = normalizeConnectionId(rawId) ?? String(rawId ?? "");
    const meta = getWhiteGloveConnection(id);
    if (!meta || meta.markReadyRequiresConnected !== false) return false;
    return whiteGloveConnectionSatisfiesConnect({
      connectionId: id,
      connectionStatus: connectionStatuses[id] ?? connectionStatuses[rawId],
      pendingOpsRequests,
    });
  });
}

export function whiteGloveBlocksConnectComplete({
  connectionIds = [],
  connectionStatuses = {},
  pendingOpsRequests = {},
} = {}) {
  const ids = (Array.isArray(connectionIds) ? connectionIds : [])
    .map((rawId) => normalizeConnectionId(rawId) ?? String(rawId ?? ""))
    .filter((id) => isWhiteGloveConnection(id));
  if (!ids.length) return false;

  if (ids.some((id) => whiteGloveConnectionSatisfiesConnect({
    connectionId: id,
    connectionStatus: connectionStatuses[id],
    pendingOpsRequests,
  }))) {
    return false;
  }

  for (const id of ids) {
    const phase = resolveWhiteGloveOwnerPhase({
      connectionId: id,
      connectionStatus: connectionStatuses[id],
      pendingOpsRequests,
    });
    if (phase === "pending" || phase === "request") return true;
  }
  return false;
}
