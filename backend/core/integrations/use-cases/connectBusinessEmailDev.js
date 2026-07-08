import { CONNECTION_STATUSES } from "../connections/ConnectionStatus.js";

const DEV_MOCK_PROVIDER = "provider_mock_email";

/**
 * Connect business email for local/dev using the mock provider.
 * Production Gmail/SMTP uses the same ConnectionService lifecycle with a different provider.
 */
export async function connectBusinessEmailDev({ integrationPlatform, workspaceId, nowISO } = {}) {
  if (!integrationPlatform?.connectionService || !integrationPlatform?.connectionRuntime) {
    throw new Error("connectBusinessEmailDev: integrationPlatform required.");
  }

  const { connectionService, connectionRuntime, credentialResolver } = integrationPlatform;
  let conn = connectionRuntime.getConnectionByType?.("business_email");
  if (!conn) {
    conn = connectionService.registerRequirement({
      workspaceId: String(workspaceId ?? "default"),
      connectionType: "business_email",
      displayName: "Business Email",
    });
  }

  if (conn.status === CONNECTION_STATUSES.NOT_CONNECTED) {
    connectionService.startConfiguration({ connectionId: conn.id, providerType: DEV_MOCK_PROVIDER });
    connectionService.attachMockCredentials({ connectionId: conn.id, providerType: DEV_MOCK_PROVIDER });
  }

  if (conn.status !== CONNECTION_STATUSES.CONNECTED) {
    await connectionService.verifyConnection({ connectionId: conn.id, credentialResolver });
  }

  return connectionRuntime.getConnectionByType("business_email");
}
