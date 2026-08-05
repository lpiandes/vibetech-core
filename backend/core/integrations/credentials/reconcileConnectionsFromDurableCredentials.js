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
  const summaries = listVaultSummaries(credentialVault, workspaceId);

  const gmail = summaries.find((row) => String(row.providerType) === "gmail")
    ?? (credentialVault?.has?.(`cred_gmail_${workspaceId}`)
      ? { credentialId: `cred_gmail_${workspaceId}`, providerType: "gmail", metadata: {} }
      : null);
  if (gmail?.credentialId) {
    const conn = runtime.getConnectionByType?.("business_email");
    const status = String(conn?.status ?? CONNECTION_STATUSES.NOT_CONNECTED).toUpperCase();
    if (status !== CONNECTION_STATUSES.CONNECTED) {
      const record = credentialVault?.get?.(gmail.credentialId);
      await connectBusinessEmailGmail({
        integrationPlatform,
        workspaceId,
        credentialId: gmail.credentialId,
        senderEmail:
          gmail.metadata?.senderEmail
          ?? record?.metadata?.senderEmail
          ?? record?.secrets?.senderEmail
          ?? null,
      });
      healed.push("business_email");
    }
  }

  const gcal = summaries.find((row) => String(row.providerType) === "google_calendar")
    ?? (credentialVault?.has?.(`cred_gcal_${workspaceId}`)
      ? { credentialId: `cred_gcal_${workspaceId}`, providerType: "google_calendar", metadata: {} }
      : null);
  if (gcal?.credentialId) {
    const conn = runtime.getConnectionByType?.("calendar");
    const status = String(conn?.status ?? CONNECTION_STATUSES.NOT_CONNECTED).toUpperCase();
    if (status !== CONNECTION_STATUSES.CONNECTED) {
      const record = credentialVault?.get?.(gcal.credentialId);
      const senderEmail =
        gcal.metadata?.senderEmail
        ?? record?.metadata?.senderEmail
        ?? record?.secrets?.senderEmail
        ?? null;
      await connectProviderConnection({
        integrationPlatform,
        workspaceId,
        connectionType: "calendar",
        displayName: "Calendar",
        providerType: "google_calendar",
        credentialId: gcal.credentialId,
        credentialType: "oauth2",
        externalAccountReference: senderEmail ? `gcal:${senderEmail}` : `gcal:${gcal.credentialId}`,
        metadata: { senderEmail },
      });
      healed.push("calendar");
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

function listVaultSummaries(vault, workspaceId) {
  if (!vault) return [];
  if (typeof vault.listSummaries === "function") {
    return vault.listSummaries() ?? [];
  }
  const known = [];
  for (const credentialId of [`cred_gmail_${workspaceId}`, `cred_gcal_${workspaceId}`]) {
    if (typeof vault.summarize === "function") {
      const summary = vault.summarize(credentialId);
      if (summary) known.push(summary);
    } else if (typeof vault.has === "function" && vault.has(credentialId)) {
      const record = vault.get?.(credentialId);
      if (record) {
        known.push({
          credentialId: record.credentialId,
          providerType: record.providerType,
          metadata: record.metadata ?? {},
        });
      }
    }
  }
  return known;
}
