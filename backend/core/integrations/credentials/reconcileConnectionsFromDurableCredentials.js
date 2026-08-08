import { CONNECTION_STATUSES } from "../connections/ConnectionStatus.js";
import { connectBusinessEmailGmail } from "../use-cases/connectBusinessEmailGmail.js";
import { connectProviderConnection } from "../use-cases/connectProviderConnection.js";
import { persistAffectedRuntimes } from "../../persistence/PersistedMutationCoordinator.js";
import { RUNTIME_SNAPSHOT_KINDS } from "../../persistence/RuntimeSnapshotKinds.js";
import {
  connectionIdFromCredentialRow,
  credentialRowImpliesConnected,
} from "./connectionStatusesFromDurableCredentials.js";
import { syncOwnerVisibleConnection } from "../connections/syncOwnerVisibleConnection.js";

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
  platformStore = null,
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

  // White-glove / API-key channels from durable vault rows.
  const knownIds = [
    `cred_twilio_sms_${workspaceId}`,
    `cred_twilio_voice_${workspaceId}`,
    `cred_meta_${workspaceId}`,
    `cred_hubspot_${workspaceId}`,
    `cred_highlevel_${workspaceId}`,
  ];
  const extraIds = typeof credentialVault?.listIds === "function"
    ? credentialVault.listIds().filter((id) => String(id).includes(workspaceId))
    : [];
  const candidateIds = [...new Set([...knownIds, ...extraIds])];

  for (const credentialId of candidateIds) {
    if (!credentialVault?.has?.(credentialId)) continue;
    const record = credentialVault.get?.(credentialId);
    if (!credentialRowImpliesConnected(record)) continue;
    const connectionType = connectionIdFromCredentialRow({
      ...record,
      credentialId,
      providerType: record?.providerType,
    });
    if (!connectionType || connectionType === "business_email" || connectionType === "calendar") continue;

    const conn = runtime.getConnectionByType?.(connectionType);
    const status = String(conn?.status ?? CONNECTION_STATUSES.NOT_CONNECTED).toUpperCase();
    if (status === CONNECTION_STATUSES.CONNECTED) {
      if (platformStore) {
        await syncOwnerVisibleConnection({
          platformStore,
          businessId: workspaceId,
          connectionId: connectionType,
          connectionStatus: "CONNECTED",
          providerType: record?.providerType,
          credentialId,
        }).catch(() => null);
      }
      continue;
    }

    const providerType = String(record?.providerType ?? connectionType);
    const fromNumber = record?.metadata?.fromNumber ?? record?.secrets?.fromNumber ?? null;
    const pageId = record?.metadata?.pageId ?? record?.secrets?.pageId ?? null;
    const locationId = record?.metadata?.locationId ?? record?.secrets?.locationId ?? null;
    const displayName = {
      voice_channel: "Phone",
      sms_channel: "Text messaging",
      meta_lead_ads: "Facebook Lead Ads",
      hubspot: "HubSpot",
      highlevel: "HighLevel",
    }[connectionType] ?? connectionType;

    const connection = await connectProviderConnection({
      integrationPlatform,
      workspaceId,
      connectionType,
      displayName,
      providerType,
      credentialId,
      credentialType: connectionType === "meta_lead_ads" ? "oauth2" : "api_key",
      externalAccountReference: fromNumber
        ? `${providerType}:${fromNumber}`
        : pageId
          ? `${providerType}:${pageId}`
          : locationId
            ? `${providerType}:${locationId}`
            : `${providerType}:${credentialId}`,
      metadata: {
        fromNumber,
        pageId,
        locationId,
      },
    }).catch(() => null);

    if (String(connection?.status ?? "").toUpperCase() === CONNECTION_STATUSES.CONNECTED) {
      healed.push(connectionType);
      if (platformStore) {
        await syncOwnerVisibleConnection({
          platformStore,
          businessId: workspaceId,
          connectionId: connectionType,
          connectionStatus: "CONNECTED",
          providerType,
          credentialId,
        }).catch(() => null);
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

  if (hasGmailCred && email !== CONNECTION_STATUSES.CONNECTED) return true;
  if (hasGcalCred && calendar !== CONNECTION_STATUSES.CONNECTED) return true;

  for (const credentialId of [
    `cred_twilio_sms_${workspaceId}`,
    `cred_twilio_voice_${workspaceId}`,
    `cred_meta_${workspaceId}`,
    `cred_hubspot_${workspaceId}`,
    `cred_highlevel_${workspaceId}`,
  ]) {
    if (!vault?.has?.(credentialId)) continue;
    const record = vault.get?.(credentialId);
    if (!credentialRowImpliesConnected(record)) continue;
    const connectionType = connectionIdFromCredentialRow({
      ...record,
      credentialId,
      providerType: record?.providerType,
    });
    if (!connectionType) continue;
    const status = String(runtime.getConnectionByType(connectionType)?.status ?? "").toUpperCase();
    if (status !== CONNECTION_STATUSES.CONNECTED) return true;
  }
  return false;
}
