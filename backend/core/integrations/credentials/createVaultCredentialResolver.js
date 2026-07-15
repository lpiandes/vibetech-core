import { CredentialResolver } from "./CredentialResolver.js";
import { createMockCredentialResolver } from "./MockCredentialResolver.js";
import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";

/**
 * CredentialResolver that prefers vault-backed secrets, falling back to mock resolvers.
 */
export function createVaultCredentialResolver({ vault, fallback = createMockCredentialResolver() } = {}) {
  if (!vault) throw new Error("createVaultCredentialResolver: vault required.");

  const resolver = new CredentialResolver();

  const resolveFromVault = (ref) => {
    const record = vault.get(ref.credentialId);
    if (!record) {
      throw new Error(`CredentialVault: credential not found: ${ref.credentialId}`);
    }
    return {
      credentialId: record.credentialId,
      providerType: record.providerType,
      ...record.secrets,
      metadata: deepFreeze(record.metadata ?? {}),
    };
  };

  const register = (providerType) => {
    resolver.register(providerType, (ref) => {
      if (vault.has(ref.credentialId)) return resolveFromVault(ref);
      return fallback.resolve({ ...ref, providerType: ref.providerType || providerType });
    });
  };

  for (const providerType of [
    "gmail",
    "google_calendar",
    "twilio_sms",
    "twilio_voice",
    "meta_lead_ads",
    "provider_mock_email",
    "provider_mock_sms",
    "provider_mock_external",
    "provider_mock_voice",
    "provider_mock_form",
  ]) {
    register(providerType);
  }

  return resolver;
}
