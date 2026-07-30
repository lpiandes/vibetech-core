import { GmailIntegrationAdapter } from "./GmailIntegrationAdapter.js";
import { GoogleCalendarIntegrationAdapter } from "./GoogleCalendarIntegrationAdapter.js";
import { GoogleSearchConsoleIntegrationAdapter } from "./GoogleSearchConsoleIntegrationAdapter.js";
import { GoogleAdsIntegrationAdapter } from "./GoogleAdsIntegrationAdapter.js";
import { TwilioSmsIntegrationAdapter, isTwilioSmsConfigured } from "./TwilioSmsIntegrationAdapter.js";
import { TwilioVoiceIntegrationAdapter, isTwilioVoiceConfigured } from "./TwilioVoiceIntegrationAdapter.js";
import { MetaLeadAdsIntegrationAdapter, isMetaLeadAdsConfigured } from "./MetaLeadAdsIntegrationAdapter.js";
import { MetaAdsIntegrationAdapter } from "./MetaAdsIntegrationAdapter.js";
import { TikTokLeadAdsIntegrationAdapter, isTikTokLeadAdsConfigured } from "./TikTokLeadAdsIntegrationAdapter.js";
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
  // TikTok is VIBETech-managed and scaffold-stage — only register when platform credentials exist.
  if (force || isTikTokLeadAdsConfigured()) {
    providers.push(new TikTokLeadAdsIntegrationAdapter({ nowISO }));
  }

  return providers;
}

export function liveIntegrationAvailability() {
  const googleOAuth = isGoogleOAuthAppConfigured();
  const metaConfigured = isMetaLeadAdsConfigured();
  const tiktokConfigured = isTikTokLeadAdsConfigured();
  const serperConfigured = Boolean(String(process.env.SERPER_API_KEY ?? "").trim());
  return {
    // Email always listed (oauth when Google app configured, else dev_connect when allowed).
    business_email: true,
    business_email_oauth: googleOAuth,
    calendar: googleOAuth,
    google_search_console: googleOAuth,
    // Ads / Drive / accounting stay hidden until connect+prove is finished product.
    google_ads: false,
    meta_ads: false,
    sms_channel: true,
    voice_channel: true,
    social_screening: serperConfigured,
    prospecting_enrichment: serperConfigured,
    meta_lead_ads: metaConfigured,
    // VIBETech-managed, scaffold stage — never claim available until platform TikTok credentials exist.
    tiktok_lead_ads: tiktokConfigured,
    document_storage: false,
    accounting: false,
    _googleOAuth: googleOAuth,
    _twilioSmsEnv: isTwilioSmsConfigured(),
    _twilioVoiceEnv: isTwilioVoiceConfigured(),
    _metaEnv: metaConfigured,
    _tiktokEnv: tiktokConfigured,
  };
}
