import { CredentialResolver } from "./CredentialResolver.js";
import { createMockCredentialResolver } from "./MockCredentialResolver.js";
import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";

const LIVE_PROVIDER_TYPES = Object.freeze([
  "gmail",
  "google_calendar",
  "google_search_console",
  "google_ads",
  "outlook",
  "outlook_calendar",
  "twilio_sms",
  "twilio_voice",
  "meta_lead_ads",
  "meta_ads",
  "hubspot",
  "highlevel",
  "provider_mock_email",
  "provider_mock_sms",
  "provider_mock_external",
  "provider_mock_voice",
  "provider_mock_form",
]);

/**
 * CredentialResolver that prefers vault-backed secrets, falling back to mock resolvers.
 * Unknown providerTypes still resolve from the vault by credentialId (avoids Next.js
 * duplicate-module / stale registration failures for live adapters like twilio_sms).
 */
export function createVaultCredentialResolver({ vault, fallback = createMockCredentialResolver() } = {}) {
  if (!vault) throw new Error("createVaultCredentialResolver: vault required.");

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

  const resolveForProvider = (providerType) => (ref) => {
    if (ref?.credentialId && vault.has(ref.credentialId)) return resolveFromVault(ref);
    try {
      return fallback.resolve({ ...ref, providerType: ref.providerType || providerType });
    } catch (err) {
      const detail = err?.message ? String(err.message) : "not found";
      throw new Error(
        `CredentialVault: credential not found for ${providerType} (${ref?.credentialId ?? "missing id"}): ${detail}`,
      );
    }
  };

  const resolver = new CredentialResolver({
    defaultResolver: (ref) => {
      if (ref?.credentialId && vault.has(ref.credentialId)) return resolveFromVault(ref);
      const providerType = String(ref?.providerType ?? "unknown");
      throw new Error(
        `CredentialVault: credential not found for ${providerType} (${ref?.credentialId ?? "missing id"}).`,
      );
    },
  });

  for (const providerType of LIVE_PROVIDER_TYPES) {
    resolver.register(providerType, resolveForProvider(providerType));
  }

  return resolver;
}
