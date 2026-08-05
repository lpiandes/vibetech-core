/**
 * Server-only live integration wiring.
 * Must only be imported from frontend/lib/server/** or API routes / AuthorizedWorkspaceService.
 */
export {
  createLiveIntegrationProviders,
  liveIntegrationAvailability,
} from "../../../backend/core/integrations/adapters/createLiveIntegrationProviders.js";

export { getSharedCredentialVault } from "../../../backend/core/integrations/credentials/CredentialVault.js";
export { getSharedOAuthStateStore } from "../../../backend/core/integrations/credentials/OAuthStateStore.js";
export {
  buildGoogleAuthorizeUrl,
  exchangeGoogleAuthorizationCode,
  GMAIL_OAUTH_SCOPES,
  GOOGLE_CALENDAR_OAUTH_SCOPES,
  GOOGLE_SEARCH_CONSOLE_OAUTH_SCOPES,
  isGoogleOAuthAppConfigured,
  getGoogleOAuthAppConfig,
  googleScopesIncludeGmailSend,
} from "../../../backend/core/integrations/oauth/GoogleOAuthClient.js";
export { isTwilioSmsConfigured } from "../../../backend/core/integrations/adapters/TwilioSmsIntegrationAdapter.js";
export { isTwilioVoiceConfigured } from "../../../backend/core/integrations/adapters/TwilioVoiceIntegrationAdapter.js";
export { isMetaLeadAdsConfigured } from "../../../backend/core/integrations/adapters/MetaLeadAdsIntegrationAdapter.js";
