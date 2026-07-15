import { CONNECTION_STATUSES } from "../connections/ConnectionStatus.js";

const GMAIL_PROVIDER = "gmail";

/**
 * Connect business email via Gmail OAuth credentials already stored in the vault.
 */
export async function connectBusinessEmailGmail({
  integrationPlatform,
  workspaceId,
  credentialId,
  senderEmail,
  nowISO,
} = {}) {
  if (!integrationPlatform?.connectionService || !integrationPlatform?.connectionRuntime) {
    throw new Error("connectBusinessEmailGmail: integrationPlatform required.");
  }
  if (!credentialId) throw new Error("connectBusinessEmailGmail: credentialId required.");

  const { connectionService, connectionRuntime, credentialResolver } = integrationPlatform;
  let conn = connectionRuntime.getConnectionByType?.("business_email");
  if (!conn) {
    conn = connectionService.registerRequirement({
      workspaceId: String(workspaceId ?? "default"),
      connectionType: "business_email",
      displayName: "Business Email",
    });
  }

  if (conn.status === CONNECTION_STATUSES.NOT_CONNECTED
    || conn.status === CONNECTION_STATUSES.DISCONNECTED
    || conn.providerType !== GMAIL_PROVIDER) {
    connectionService.startConfiguration({ connectionId: conn.id, providerType: GMAIL_PROVIDER });
    connectionService.attachProviderCredentials({
      connectionId: conn.id,
      providerType: GMAIL_PROVIDER,
      credentialId,
      credentialType: "oauth2",
      externalAccountReference: senderEmail ? `gmail:${senderEmail}` : `gmail:${credentialId}`,
      metadata: {
        senderEmail: senderEmail ? String(senderEmail) : null,
      },
    });
  }

  if (conn.status !== CONNECTION_STATUSES.CONNECTED) {
    await connectionService.verifyConnection({ connectionId: conn.id, credentialResolver });
  } else {
    // Re-verify after credential attach (status may already be CONNECTED from attach event).
    await connectionService.verifyConnection({ connectionId: conn.id, credentialResolver });
  }

  return connectionRuntime.getConnectionByType("business_email");
}
