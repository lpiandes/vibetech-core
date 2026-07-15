import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";

function fail(message) {
  throw new Error(`CredentialVault: ${message}`);
}

/**
 * In-process credential vault. Stores provider secrets keyed by credentialId.
 * Never expose raw secrets through view models or platform events — resolve only
 * inside IntegrationProvider / CommunicationProvider execution paths.
 */
export class CredentialVault {
  constructor({ store = new Map() } = {}) {
    this._store = store;
  }

  put({ credentialId, providerType, secrets, metadata = {} } = {}) {
    if (!credentialId || typeof credentialId !== "string") fail("credentialId required.");
    if (!providerType || typeof providerType !== "string") fail("providerType required.");
    if (!secrets || typeof secrets !== "object") fail("secrets object required.");

    const record = {
      credentialId: String(credentialId),
      providerType: String(providerType),
      secrets: { ...secrets },
      metadata: metadata && typeof metadata === "object" ? { ...metadata } : {},
      updatedAt: new Date().toISOString(),
    };
    this._store.set(String(credentialId), record);
    return deepFreeze({
      credentialId: record.credentialId,
      providerType: record.providerType,
      metadata: deepFreeze(record.metadata),
      updatedAt: record.updatedAt,
    });
  }

  get(credentialId) {
    const record = this._store.get(String(credentialId ?? ""));
    if (!record) return null;
    return {
      credentialId: record.credentialId,
      providerType: record.providerType,
      secrets: { ...record.secrets },
      metadata: { ...record.metadata },
      updatedAt: record.updatedAt,
    };
  }

  has(credentialId) {
    return this._store.has(String(credentialId ?? ""));
  }

  delete(credentialId) {
    return this._store.delete(String(credentialId ?? ""));
  }

  /** Non-secret summary for diagnostics — never includes secrets. */
  summarize(credentialId) {
    const record = this._store.get(String(credentialId ?? ""));
    if (!record) return null;
    return deepFreeze({
      credentialId: record.credentialId,
      providerType: record.providerType,
      metadata: deepFreeze(record.metadata),
      updatedAt: record.updatedAt,
      secretKeys: Object.keys(record.secrets ?? {}),
    });
  }
}

let sharedVault = null;

export function getSharedCredentialVault() {
  if (!sharedVault) sharedVault = new CredentialVault();
  return sharedVault;
}

export function resetSharedCredentialVaultForTests() {
  sharedVault = new CredentialVault();
  return sharedVault;
}
