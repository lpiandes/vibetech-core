import { getSharedCredentialVault } from "./CredentialVault.js";

/**
 * Persist a vault credential to encrypted Postgres and keep the in-memory vault warm.
 */
export async function putDurableCredential({
  platformStore,
  vault = getSharedCredentialVault(),
  workspaceId,
  credentialId,
  providerType,
  secrets,
  metadata = {},
} = {}) {
  if (!platformStore?.upsertIntegrationCredential) {
    throw new Error("putDurableCredential requires platformStore.upsertIntegrationCredential");
  }
  const summary = vault.put({ credentialId, providerType, secrets, metadata });
  await platformStore.upsertIntegrationCredential({
    workspaceId,
    credentialId,
    providerType,
    secrets,
    metadata,
  });
  return summary;
}

/**
 * Load encrypted credentials for a workspace into the shared vault (idempotent).
 */
export async function hydrateWorkspaceCredentials({
  platformStore,
  vault = getSharedCredentialVault(),
  workspaceId,
} = {}) {
  if (!workspaceId || !platformStore?.listIntegrationCredentialsForWorkspace) {
    return { loaded: 0 };
  }
  const rows = await platformStore.listIntegrationCredentialsForWorkspace(workspaceId);
  let loaded = 0;
  for (const row of rows) {
    if (vault.has(row.credentialId)) continue;
    vault.put({
      credentialId: row.credentialId,
      providerType: row.providerType,
      secrets: row.secrets,
      metadata: row.metadata,
    });
    loaded += 1;
  }
  return { loaded, total: rows.length };
}
