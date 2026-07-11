import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";
import { AUTH_METHODS, getProvider } from "./ProviderCatalog.js";

/**
 * Auth flow abstraction — OAuth2 / API Key / webhook secret.
 * Never stores or returns secrets — only credential references and flow steps.
 */
export function createAuthFlowPlan({ providerId, businessId = null, redirectUri = null } = {}) {
  const provider = getProvider(providerId);
  if (!provider) {
    return deepFreeze({ ok: false, reason: "unknown_provider", providerId });
  }

  const auth = AUTH_METHODS[provider.authMethod] ?? AUTH_METHODS.api_key;
  const steps = provider.authMethod === "oauth2"
    ? [
      { stepId: "authorize", label: "Authorize with provider", kind: "oauth_authorize" },
      { stepId: "callback", label: "Receive OAuth callback", kind: "oauth_callback" },
      { stepId: "store_ref", label: "Store credential reference (encrypted vault)", kind: "store_reference" },
      { stepId: "verify", label: "Verify connection", kind: "verify" },
    ]
    : provider.authMethod === "webhook_secret"
      ? [
        { stepId: "create_endpoint", label: "Create webhook endpoint", kind: "webhook_endpoint" },
        { stepId: "store_ref", label: "Store secret reference", kind: "store_reference" },
        { stepId: "verify", label: "Validate signature", kind: "verify" },
      ]
      : [
        { stepId: "enter_key", label: "Enter API key (never logged)", kind: "api_key_input" },
        { stepId: "store_ref", label: "Store credential reference (encrypted vault)", kind: "store_reference" },
        { stepId: "verify", label: "Test connection", kind: "verify" },
      ];

  return deepFreeze({
    ok: true,
    providerId: provider.providerId,
    authMethod: provider.authMethod,
    supportsRefresh: Boolean(auth.supportsRefresh),
    supportsScopes: Boolean(auth.supportsScopes),
    scopes: provider.scopes,
    encryptionRequired: true,
    secretsExposed: false,
    businessId: businessId ?? null,
    redirectUri: redirectUri ?? null,
    credentialReferenceShape: {
      credentialId: null,
      providerId: provider.providerId,
      authMethod: provider.authMethod,
      // Never include secret, token, or refreshToken values here.
    },
    steps,
  });
}

/**
 * Validate that a credential reference is safe (no secret material).
 */
export function assertSafeCredentialReference(reference = {}) {
  const forbidden = ["secret", "apiKey", "api_key", "token", "accessToken", "refreshToken", "password", "clientSecret"];
  const keys = Object.keys(reference ?? {});
  const leaks = keys.filter((key) => forbidden.includes(key) || /secret|token|password/i.test(key));
  // Allow credentialId, providerId, authMethod, scopes, expiresAt, encryptedRef
  const allowedLeakish = new Set(["encryptedRef", "tokenType", "expiresAt"]);
  const bad = leaks.filter((key) => !allowedLeakish.has(key));
  return deepFreeze({
    ok: bad.length === 0,
    leaks: bad,
    safe: bad.length === 0,
  });
}
