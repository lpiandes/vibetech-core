import { CONNECTION_STATUSES } from "../connections/ConnectionStatus.js";

/**
 * Generic connect helper: register → configure → attach vault credential → verify.
 */
export async function connectProviderConnection({
  integrationPlatform,
  workspaceId,
  connectionType,
  displayName,
  providerType,
  credentialId,
  credentialType = "oauth2",
  externalAccountReference = null,
  metadata = {},
} = {}) {
  if (!integrationPlatform?.connectionService || !integrationPlatform?.connectionRuntime) {
    throw new Error("connectProviderConnection: integrationPlatform required.");
  }
  if (!connectionType) throw new Error("connectProviderConnection: connectionType required.");
  if (!providerType) throw new Error("connectProviderConnection: providerType required.");
  if (!credentialId) throw new Error("connectProviderConnection: credentialId required.");

  const { connectionService, connectionRuntime, credentialResolver } = integrationPlatform;
  let conn = connectionRuntime.getConnectionByType?.(connectionType);
  if (!conn) {
    conn = connectionService.registerRequirement({
      workspaceId: String(workspaceId ?? "default"),
      connectionType: String(connectionType),
      displayName: displayName ?? String(connectionType),
    });
  }

  if (
    conn.status === CONNECTION_STATUSES.NOT_CONNECTED
    || conn.status === CONNECTION_STATUSES.DISCONNECTED
    || conn.providerType !== providerType
  ) {
    connectionService.startConfiguration({ connectionId: conn.id, providerType });
    connectionService.attachProviderCredentials({
      connectionId: conn.id,
      providerType,
      credentialId,
      credentialType,
      externalAccountReference: externalAccountReference ?? `${providerType}:${credentialId}`,
      metadata,
    });
  }

  await connectionService.verifyConnection({ connectionId: conn.id, credentialResolver });
  return connectionRuntime.getConnectionByType(connectionType);
}
