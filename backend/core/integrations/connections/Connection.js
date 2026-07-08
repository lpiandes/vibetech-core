import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";
import { CONNECTION_STATUSES, isValidConnectionStatus } from "./ConnectionStatus.js";

function fail(message) {
  throw new Error(`Connection: ${message}`);
}

export function createConnection({
  id,
  workspaceId,
  connectionType,
  providerType,
  displayName,
  status,
  capabilities,
  configurationReference,
  credentialReference,
  externalAccountReference,
  connectedAt,
  lastVerifiedAt,
  lastSuccessfulActivityAt,
  lastFailureAt,
  health,
  metadata,
  createdAt,
  updatedAt,
} = {}) {
  if (!id || typeof id !== "string") fail("id required.");
  if (!workspaceId || typeof workspaceId !== "string") fail("workspaceId required.");
  if (!connectionType || typeof connectionType !== "string") fail("connectionType required.");

  const st = String(status ?? CONNECTION_STATUSES.NOT_CONNECTED);
  if (!isValidConnectionStatus(st)) fail(`invalid status: ${st}`);

  return deepFreeze({
    id: String(id),
    workspaceId: String(workspaceId),
    connectionType: String(connectionType),
    providerType: providerType === undefined || providerType === null ? null : String(providerType),
    displayName: String(displayName ?? connectionType),
    status: st,
    capabilities: deepFreeze(Array.isArray(capabilities) ? capabilities.map(String) : []),
    configurationReference:
      configurationReference && typeof configurationReference === "object"
        ? deepFreeze(configurationReference)
        : deepFreeze({}),
    credentialReference:
      credentialReference && typeof credentialReference === "object" ? credentialReference : null,
    externalAccountReference:
      externalAccountReference === undefined || externalAccountReference === null
        ? null
        : String(externalAccountReference),
    connectedAt: connectedAt ?? null,
    lastVerifiedAt: lastVerifiedAt ?? null,
    lastSuccessfulActivityAt: lastSuccessfulActivityAt ?? null,
    lastFailureAt: lastFailureAt ?? null,
    health: health && typeof health === "object" ? deepFreeze(health) : deepFreeze({ level: "DISCONNECTED" }),
    metadata: metadata && typeof metadata === "object" ? deepFreeze(metadata) : deepFreeze({}),
    createdAt: String(createdAt ?? "2026-07-01T00:00:00.000Z"),
    updatedAt: String(updatedAt ?? "2026-07-01T00:00:00.000Z"),
  });
}
