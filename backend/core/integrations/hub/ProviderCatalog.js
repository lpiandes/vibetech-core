import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";
import { INTEGRATION_CAPABILITIES } from "../capabilities/IntegrationCapability.js";

/**
 * Universal hub capabilities — Architect resolves needs by capability, not provider.
 * Extends platform capabilities with human-facing capability ids used in recommendations.
 */
export const HUB_CAPABILITIES = deepFreeze({
  send_email: { capabilityId: "send_email", label: "Send Email", platform: INTEGRATION_CAPABILITIES.SEND_EMAIL },
  read_email: { capabilityId: "read_email", label: "Read Email", platform: INTEGRATION_CAPABILITIES.SEND_EMAIL },
  send_sms: { capabilityId: "send_sms", label: "Send SMS", platform: INTEGRATION_CAPABILITIES.SEND_SMS },
  calendar_read: { capabilityId: "calendar_read", label: "Calendar Read", platform: INTEGRATION_CAPABILITIES.READ_CALENDAR_AVAILABILITY },
  calendar_write: { capabilityId: "calendar_write", label: "Calendar Write", platform: INTEGRATION_CAPABILITIES.CREATE_CALENDAR_EVENT },
  contacts: { capabilityId: "contacts", label: "Contacts", platform: INTEGRATION_CAPABILITIES.SYNC_CONTACT },
  invoices: { capabilityId: "invoices", label: "Invoices", platform: INTEGRATION_CAPABILITIES.READ_EXTERNAL_RECORD },
  payments: { capabilityId: "payments", label: "Payments", platform: INTEGRATION_CAPABILITIES.CREATE_EXTERNAL_RECORD },
  files: { capabilityId: "files", label: "Files", platform: INTEGRATION_CAPABILITIES.INGEST_DOCUMENT },
  meetings: { capabilityId: "meetings", label: "Meetings", platform: INTEGRATION_CAPABILITIES.CREATE_CALENDAR_EVENT },
  messages: { capabilityId: "messages", label: "Messages", platform: INTEGRATION_CAPABILITIES.SEND_SMS },
  webhooks: { capabilityId: "webhooks", label: "Webhooks", platform: INTEGRATION_CAPABILITIES.RECEIVE_WEBHOOK },
  crm_records: { capabilityId: "crm_records", label: "CRM Records", platform: INTEGRATION_CAPABILITIES.READ_EXTERNAL_RECORD },
  ecommerce: { capabilityId: "ecommerce", label: "E-Commerce", platform: INTEGRATION_CAPABILITIES.READ_EXTERNAL_RECORD },
  scheduling: { capabilityId: "scheduling", label: "Scheduling", platform: INTEGRATION_CAPABILITIES.READ_CALENDAR_AVAILABILITY },
  create_ad_campaign: { capabilityId: "create_ad_campaign", label: "Create ad campaign", platform: INTEGRATION_CAPABILITIES.CREATE_AD_CAMPAIGN },
  read_ad_performance: { capabilityId: "read_ad_performance", label: "Read ad performance", platform: INTEGRATION_CAPABILITIES.READ_AD_PERFORMANCE },
  read_search_performance: { capabilityId: "read_search_performance", label: "Read search performance", platform: INTEGRATION_CAPABILITIES.READ_SEARCH_PERFORMANCE },
});

export const AUTH_METHODS = deepFreeze({
  oauth2: { authMethod: "oauth2", label: "OAuth2", supportsRefresh: true, supportsScopes: true },
  api_key: { authMethod: "api_key", label: "API Key", supportsRefresh: false, supportsScopes: false },
  webhook_secret: { authMethod: "webhook_secret", label: "Webhook Secret", supportsRefresh: false, supportsScopes: false },
});

/**
 * Reusable provider catalog — one platform for every business.
 * Adapters declare capabilities; Architect never hardcodes vertical logic.
 */
function provider(def) {
  return deepFreeze({
    providerId: def.providerId,
    label: def.label,
    category: def.category,
    authMethod: def.authMethod,
    capabilities: def.capabilities,
    connectionType: def.connectionType,
    rateLimitPerMinute: def.rateLimitPerMinute ?? 60,
    setupGuide: def.setupGuide ?? `Connect ${def.label} to enable ${def.capabilities.join(", ")}.`,
    scopes: def.scopes ?? [],
    status: def.status ?? "available",
  });
}

export const PROVIDER_CATALOG = deepFreeze({
  // Communication
  gmail: provider({
    providerId: "gmail",
    label: "Gmail",
    category: "communication",
    authMethod: "oauth2",
    connectionType: "business_email",
    capabilities: ["send_email", "read_email"],
    scopes: ["email.send", "email.read"],
    setupGuide: "Connect Google OAuth for Gmail send/read. Secrets stay in credential vault.",
  }),
  outlook: provider({
    providerId: "outlook",
    label: "Outlook",
    category: "communication",
    authMethod: "oauth2",
    connectionType: "business_email",
    capabilities: ["send_email", "read_email"],
    scopes: ["Mail.Send", "Mail.Read"],
  }),
  microsoft_365: provider({
    providerId: "microsoft_365",
    label: "Microsoft 365",
    category: "communication",
    authMethod: "oauth2",
    connectionType: "business_email",
    capabilities: ["send_email", "read_email", "calendar_read", "calendar_write", "files"],
    scopes: ["Mail.Send", "Calendars.ReadWrite", "Files.Read"],
  }),
  google_workspace: provider({
    providerId: "google_workspace",
    label: "Google Workspace",
    category: "communication",
    authMethod: "oauth2",
    connectionType: "business_email",
    capabilities: ["send_email", "read_email", "calendar_read", "calendar_write", "files", "contacts"],
    scopes: ["email", "calendar", "drive"],
  }),
  twilio: provider({
    providerId: "twilio",
    label: "Twilio",
    category: "communication",
    authMethod: "api_key",
    connectionType: "sms_channel",
    capabilities: ["send_sms", "messages"],
  }),
  slack: provider({
    providerId: "slack",
    label: "Slack",
    category: "communication",
    authMethod: "oauth2",
    connectionType: "business_email",
    capabilities: ["messages", "webhooks"],
    scopes: ["chat:write", "channels:read"],
  }),
  microsoft_teams: provider({
    providerId: "microsoft_teams",
    label: "Microsoft Teams",
    category: "communication",
    authMethod: "oauth2",
    connectionType: "business_email",
    capabilities: ["messages", "meetings"],
  }),
  zoom: provider({
    providerId: "zoom",
    label: "Zoom",
    category: "communication",
    authMethod: "oauth2",
    connectionType: "calendar",
    capabilities: ["meetings", "webhooks"],
  }),
  // Calendar
  google_calendar: provider({
    providerId: "google_calendar",
    label: "Google Calendar",
    category: "calendar",
    authMethod: "oauth2",
    connectionType: "calendar",
    capabilities: ["calendar_read", "calendar_write", "scheduling"],
  }),
  outlook_calendar: provider({
    providerId: "outlook_calendar",
    label: "Outlook Calendar",
    category: "calendar",
    authMethod: "oauth2",
    connectionType: "calendar",
    capabilities: ["calendar_read", "calendar_write", "scheduling"],
  }),
  microsoft_calendar: provider({
    providerId: "microsoft_calendar",
    label: "Microsoft Calendar",
    category: "calendar",
    authMethod: "oauth2",
    connectionType: "calendar",
    capabilities: ["calendar_read", "calendar_write"],
  }),
  // Accounting
  quickbooks_online: provider({
    providerId: "quickbooks_online",
    label: "QuickBooks Online",
    category: "accounting",
    authMethod: "oauth2",
    connectionType: "accounting",
    capabilities: ["invoices", "payments", "contacts"],
  }),
  xero: provider({
    providerId: "xero",
    label: "Xero",
    category: "accounting",
    authMethod: "oauth2",
    connectionType: "accounting",
    capabilities: ["invoices", "payments", "contacts"],
  }),
  // Payments
  stripe: provider({
    providerId: "stripe",
    label: "Stripe",
    category: "payments",
    authMethod: "api_key",
    connectionType: "accounting",
    capabilities: ["payments", "webhooks"],
  }),
  square: provider({
    providerId: "square",
    label: "Square",
    category: "payments",
    authMethod: "oauth2",
    connectionType: "accounting",
    capabilities: ["payments", "invoices"],
  }),
  // CRM
  hubspot: provider({
    providerId: "hubspot",
    label: "HubSpot",
    category: "crm",
    authMethod: "oauth2",
    connectionType: "property_management_system",
    capabilities: ["crm_records", "contacts", "webhooks"],
  }),
  salesforce: provider({
    providerId: "salesforce",
    label: "Salesforce",
    category: "crm",
    authMethod: "oauth2",
    connectionType: "property_management_system",
    capabilities: ["crm_records", "contacts", "webhooks"],
  }),
  // E-commerce
  shopify: provider({
    providerId: "shopify",
    label: "Shopify",
    category: "ecommerce",
    authMethod: "oauth2",
    connectionType: "property_management_system",
    capabilities: ["ecommerce", "payments", "contacts", "webhooks"],
  }),
  woocommerce: provider({
    providerId: "woocommerce",
    label: "WooCommerce",
    category: "ecommerce",
    authMethod: "api_key",
    connectionType: "property_management_system",
    capabilities: ["ecommerce", "webhooks"],
  }),
  // Storage
  google_drive: provider({
    providerId: "google_drive",
    label: "Google Drive",
    category: "storage",
    authMethod: "oauth2",
    connectionType: "document_storage",
    capabilities: ["files"],
  }),
  onedrive: provider({
    providerId: "onedrive",
    label: "OneDrive",
    category: "storage",
    authMethod: "oauth2",
    connectionType: "document_storage",
    capabilities: ["files"],
  }),
  dropbox: provider({
    providerId: "dropbox",
    label: "Dropbox",
    category: "storage",
    authMethod: "oauth2",
    connectionType: "document_storage",
    capabilities: ["files"],
  }),
  // Scheduling
  calendly: provider({
    providerId: "calendly",
    label: "Calendly",
    category: "scheduling",
    authMethod: "oauth2",
    connectionType: "calendar",
    capabilities: ["scheduling", "calendar_read", "webhooks"],
  }),
  // Growth channels are visible to every pack. They remain intentionally
  // non-live until their OAuth/webhook adapters and live verification ship.
  google_ads: provider({
    providerId: "google_ads",
    label: "Google Ads",
    category: "advertising",
    authMethod: "oauth2",
    connectionType: "google_ads",
    capabilities: ["create_ad_campaign", "read_ad_performance"],
    scopes: ["https://www.googleapis.com/auth/adwords"],
    status: "planned",
    setupGuide: "Google Ads connection is planned. Do not treat campaigns as live until the account connection and first test campaign are verified.",
  }),
  google_search_console: provider({
    providerId: "google_search_console",
    label: "Google Search Console",
    category: "seo",
    authMethod: "oauth2",
    connectionType: "google_search_console",
    capabilities: ["read_search_performance"],
    scopes: ["https://www.googleapis.com/auth/webmasters.readonly"],
    status: "planned",
    setupGuide: "Search Console connection is planned. It will report search performance; it does not claim to create rankings.",
  }),
  meta_ads: provider({
    providerId: "meta_ads",
    label: "Meta Ads",
    category: "advertising",
    authMethod: "oauth2",
    connectionType: "meta_ads",
    capabilities: ["create_ad_campaign", "read_ad_performance"],
    scopes: ["ads_management", "ads_read"],
    status: "planned",
    setupGuide: "Meta Ads connection is planned. Do not treat campaigns as live until account connection, permissions, and a test campaign are verified.",
  }),
  tiktok_ads: provider({
    providerId: "tiktok_ads",
    label: "TikTok Lead Ads (VIBETech-managed)",
    category: "advertising",
    authMethod: "api_key",
    connectionType: "tiktok_lead_ads",
    capabilities: ["create_ad_campaign", "webhooks"],
    status: "planned",
    setupGuide: "VIBETech-managed TikTok lead ads is rolling out. Platform Marketing API credentials must be configured before any campaign scaffolding is treated as live.",
  }),
  // Generic
  rest_api: provider({
    providerId: "rest_api",
    label: "REST API",
    category: "generic",
    authMethod: "api_key",
    connectionType: "property_management_system",
    capabilities: ["crm_records", "webhooks"],
  }),
  webhook: provider({
    providerId: "webhook",
    label: "Webhook",
    category: "generic",
    authMethod: "webhook_secret",
    connectionType: "property_management_system",
    capabilities: ["webhooks"],
  }),
  oauth2_generic: provider({
    providerId: "oauth2_generic",
    label: "OAuth2",
    category: "generic",
    authMethod: "oauth2",
    connectionType: "property_management_system",
    capabilities: ["crm_records", "webhooks"],
  }),
  api_key_generic: provider({
    providerId: "api_key_generic",
    label: "API Key",
    category: "generic",
    authMethod: "api_key",
    connectionType: "property_management_system",
    capabilities: ["crm_records"],
  }),
});

/** Industry templates pick providers by capability need — not vertical integration engines. */
export const INTEGRATION_TEMPLATES = deepFreeze({
  property_management: {
    recommendedProviderIds: ["gmail", "google_calendar", "twilio", "quickbooks_online", "stripe", "google_drive"],
  },
  dental: {
    recommendedProviderIds: ["gmail", "outlook", "google_calendar", "stripe", "twilio", "dropbox", "google_ads", "google_search_console", "meta_ads"],
  },
  sports: {
    recommendedProviderIds: ["gmail", "google_calendar", "slack", "stripe", "google_drive", "calendly", "google_ads", "google_search_console", "meta_ads"],
  },
  default: {
    recommendedProviderIds: ["gmail", "google_calendar", "stripe", "hubspot", "slack", "google_drive"],
  },
});

export function getProvider(providerId) {
  return PROVIDER_CATALOG[String(providerId)] ?? null;
}

export function listProviderIds() {
  return Object.keys(PROVIDER_CATALOG);
}

export function listProvidersByCapability(capabilityId) {
  return Object.values(PROVIDER_CATALOG).filter((provider) => (
    provider.capabilities.includes(String(capabilityId))
  ));
}

export function resolveIntegrationTemplate(industry) {
  const key = String(industry ?? "default");
  return INTEGRATION_TEMPLATES[key] ?? INTEGRATION_TEMPLATES.default;
}

export function resolveCapability(capabilityId) {
  return HUB_CAPABILITIES[String(capabilityId)] ?? null;
}

export function listHubCapabilityIds() {
  return Object.keys(HUB_CAPABILITIES);
}
