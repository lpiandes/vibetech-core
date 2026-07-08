import { CredentialResolver } from "./CredentialResolver.js";
import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";

/**
 * Development-only credential resolver. Returns non-secret mock handles.
 */
export function createMockCredentialResolver() {
  const resolver = new CredentialResolver({
    resolvers: {
      provider_mock_email: (ref) =>
        deepFreeze({
          credentialId: ref.credentialId,
          mockAccount: "mock-email-account",
          senderIdentity: "noreply@mock.example",
        }),
      provider_mock_sms: (ref) =>
        deepFreeze({
          credentialId: ref.credentialId,
          mockAccount: "mock-sms-account",
          fromNumber: "+15550000001",
        }),
      provider_mock_external: (ref) =>
        deepFreeze({
          credentialId: ref.credentialId,
          mockSystemId: "mock-external-system",
        }),
      gmail: (ref) =>
        deepFreeze({
          credentialId: ref.credentialId,
          configured: false,
          note: "Gmail credentials resolved via environment in provider adapter for tests only.",
        }),
    },
  });
  return resolver;
}
