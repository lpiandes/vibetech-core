import { GmailIntegrationAdapter } from "./GmailIntegrationAdapter.js";
import { GoogleCalendarIntegrationAdapter } from "./GoogleCalendarIntegrationAdapter.js";
import { GoogleSearchConsoleIntegrationAdapter } from "./GoogleSearchConsoleIntegrationAdapter.js";
import { GoogleAdsIntegrationAdapter } from "./GoogleAdsIntegrationAdapter.js";
import { TwilioSmsIntegrationAdapter, isTwilioSmsConfigured } from "./TwilioSmsIntegrationAdapter.js";
import { TwilioVoiceIntegrationAdapter, isTwilioVoiceConfigured } from "./TwilioVoiceIntegrationAdapter.js";
import { MetaLeadAdsIntegrationAdapter, isMetaLeadAdsConfigured } from "./MetaLeadAdsIntegrationAdapter.js";
import { MetaAdsIntegrationAdapter } from "./MetaAdsIntegrationAdapter.js";
import { isGoogleOAuthAppConfigured } from "../oauth/GoogleOAuthClient.js";

/**
 * Live providers for the composition root / workspace activation.
 * Gmail/Calendar require Google OAuth app env. Twilio/Meta adapters are always
 * registered (fetch-based) so owners can connect with their own credentials.
 */
export function createLiveIntegrationProviders({
  nowISO = "2026-07-01T00:00:00.000Z",
  force = false,
} = {}) {
  const providers = [];

  if (force || isGoogleOAuthAppConfigured()) {
    providers.push(new GmailIntegrationAdapter({ nowISO }));
    providers.push(new GoogleCalendarIntegrationAdapter({ nowISO }));
    providers.push(new GoogleSearchConsoleIntegrationAdapter({ nowISO }));
  }
  // Always register Twilio / Meta — credentials come from vault on connect.
  providers.push(new TwilioSmsIntegrationAdapter({ nowISO }));
  providers.push(new TwilioVoiceIntegrationAdapter({ nowISO }));
  providers.push(new MetaLeadAdsIntegrationAdapter({ nowISO }));
  providers.push(new MetaAdsIntegrationAdapter({ nowISO }));
  providers.push(new GoogleAdsIntegrationAdapter({ nowISO }));

  return providers;
}

export function liveIntegrationAvailability() {
  const googleOAuth = isGoogleOAuthAppConfigured();
  return {
    // Email always listed (oauth when Google app configured, else dev_connect when allowed).
    business_email: true,
    business_email_oauth: googleOAuth,
    calendar: googleOAuth,
    google_search_console: googleOAuth,
    google_ads: true,
    meta_ads: true,
    sms_channel: true,
    voice_channel: true,
    meta_lead_ads: true,
    // Phase C connect patterns — listed as optional SoR bridges (import/read, not clone).
    document_storage: true,
    accounting: true,
    _googleOAuth: googleOAuth,
    _twilioSmsEnv: isTwilioSmsConfigured(),
    _twilioVoiceEnv: isTwilioVoiceConfigured(),
    _metaEnv: isMetaLeadAdsConfigured(),
  };
}
