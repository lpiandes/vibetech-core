import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";

function fail(message) {
  throw new Error(`CredentialReference: ${message}`);
}

/**
 * CredentialReference — stores identity only, never secrets.
 * Future persistence boundary: secure vault keyed by credentialId.
 */
export function createCredentialReference({ credentialId, credentialType, providerType, metadata } = {}) {
  if (!credentialId || typeof credentialId !== "string") fail("credentialId required.");
  if (!credentialType || typeof credentialType !== "string") fail("credentialType required.");
  if (!providerType || typeof providerType !== "string") fail("providerType required.");

  return deepFreeze({
    credentialId: String(credentialId),
    credentialType: String(credentialType),
    providerType: String(providerType),
    metadata: metadata && typeof metadata === "object" ? deepFreeze(metadata) : deepFreeze({}),
  });
}
