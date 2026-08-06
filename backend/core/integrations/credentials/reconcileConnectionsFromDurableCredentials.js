import { CONNECTION_STATUSES } from "../connections/ConnectionStatus.js";
import { connectBusinessEmailGmail } from "../use-cases/connectBusinessEmailGmail.js";
import { connectProviderConnection } from "../use-cases/connectProviderConnection.js";
import { persistAffectedRuntimes } from "../../persistence/PersistedMutationCoordinator.js";
import { RUNTIME_SNAPSHOT_KINDS } from "../../persistence/RuntimeSnapshotKinds.js";

/**
 * Credentials are durable; connection status is a runtime snapshot.
 * After vault hydrate, re-attach CONNECTED when a credential exists but the
 * runtime still says NOT_CONNECTED (common after cold serverless / stale snapshot).
 */
export async function reconcileConnectionsFromDurableCredentials({
  workspaceId,
  integrationPlatform,
  operatingStack = null,
  vault = null,
} = {}) {
  if (!workspaceId || !integrationPlatform?.connectionRuntime) {
    return { healed: [], skipped: true };
  }

  const credentialVault = vault ?? integrationPlatform.credentialVault ?? null;
  const healed = [];
  const runtime = integrationPlatform.connectionRuntime;

  const gmailId = `cred_gmail_${workspaceId}`;
  const gcalId = `cred_gcal_${workspaceId}`;

  if (credentialVault?.has?.(gmailId)) {
    const conn = runtime.getConnectionByType?.("business_email");
    const status = String(conn?.status ?? CONNECTION_STATUSES.NOT_CONNECTED).toUpperCase();
    if (status !== CONNECTION_STATUSES.CONNECTED) {
      const record = credentialVault.get?.(gmailId);
      const connection = await connectBusinessEmailGmail({
        integrationPlatform,
        workspaceId,
        credentialId: gmailId,
        senderEmail: record?.metadata?.senderEmail ?? record?.secrets?.senderEmail ?? null,
      });
      if (String(connection?.status ?? "").toUpperCase() === CONNECTION_STATUSES.CONNECTED) {
        healed.push("business_email");
      }
    }
  }

  if (credentialVault?.has?.(gcalId)) {
    const conn = runtime.getConnectionByType?.("calendar");
    const status = String(conn?.status ?? CONNECTION_STATUSES.NOT_CONNECTED).toUpperCase();
    if (status !== CONNECTION_STATUSES.CONNECTED) {
      const record = credentialVault.get?.(gcalId);
      const senderEmail = record?.metadata?.senderEmail ?? record?.secrets?.senderEmail ?? null;
      const connection = await connectProviderConnection({
        integrationPlatform,
        workspaceId,
        connectionType: "calendar",
        displayName: "Calendar",
        providerType: "google_calendar",
        credentialId: gcalId,
        credentialType: "oauth2",
        externalAccountReference: senderEmail ? `gcal:${senderEmail}` : `gcal:${gcalId}`,
        metadata: { senderEmail },
      });
      if (String(connection?.status ?? "").toUpperCase() === CONNECTION_STATUSES.CONNECTED) {
        healed.push("calendar");
      }
    }
  }

  if (healed.length) {
    await persistAffectedRuntimes({
      workspaceId,
      stack: operatingStack,
      integrationPlatform,
      kinds: [RUNTIME_SNAPSHOT_KINDS.CONNECTION],
    });
  }

  return { healed, skipped: false };
}

/** True when durable credentials exist but runtime is still not CONNECTED. */
export function connectionHealLikelyNeeded(integrationPlatform, workspaceId) {
  const runtime = integrationPlatform?.connectionRuntime;
  const vault = integrationPlatform?.credentialVault;
  if (!runtime?.getConnectionByType || !workspaceId) return false;

  const gmailId = `cred_gmail_${workspaceId}`;
  const gcalId = `cred_gcal_${workspaceId}`;
  const email = String(runtime.getConnectionByType("business_email")?.status ?? "").toUpperCase();
  const calendar = String(runtime.getConnectionByType("calendar")?.status ?? "").toUpperCase();

  const hasGmailCred = Boolean(vault?.has?.(gmailId));
  const hasGcalCred = Boolean(vault?.has?.(gcalId));

  // Never heal just because a channel was never connected — that made every
  // mid-setup Connections visit pay hydrate+reconcile.
  if (hasGmailCred && email !== CONNECTION_STATUSES.CONNECTED) return true;
  if (hasGcalCred && calendar !== CONNECTION_STATUSES.CONNECTED) return true;
  return false;
}
