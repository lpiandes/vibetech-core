import type { LucideIcon } from "lucide-react";
import { Building2, Calendar, Calculator, FileText, Mail, MessageSquare, Phone, Search, Share2, Target, Video, ClipboardList, Database } from "lucide-react";

import type { StatusBadgeTone } from "@/components/product/StatusBadge";

/** Only `live` integrations are listed. Unavailable channels are omitted entirely. */
export type IntegrationTier = "live";

export type IntegrationSetupMode = "manual" | "dev_connect" | "oauth" | "api_key" | "prove_only";

export type IntegrationDisplay = {
  id: string;
  title: string;
  description: string;
  tier: IntegrationTier;
  icon: LucideIcon;
  unlocks?: string;
  setupMode?: IntegrationSetupMode;
  /** When false, this connection is hidden from the owner UI. */
  listed?: boolean;
  /** business_email / calendar: offer a "Connect with Microsoft" option alongside Google. */
  microsoftOAuthAvailable?: boolean;
};

const INTEGRATION_CONFIG: Record<string, Omit<IntegrationDisplay, "id">> = {
  property_management_system: {
    title: "Property management software",
    description: "Sync properties, residents, leases, and work (property-management installs only)",
    tier: "live",
    icon: Building2,
    setupMode: "manual",
    listed: false, // quarantined — only shown when workspaceGate / liveFlags.property_management
  },
  business_email: {
    title: "Business email",
    description: "Send customer email after you approve it.",
    tier: "live",
    icon: Mail,
    setupMode: "oauth",
    listed: true,
    unlocks: "Approved customer email",
  },
  calendar: {
    title: "Google Calendar",
    description: "Keep your business calendar in sync.",
    tier: "live",
    icon: Calendar,
    setupMode: "oauth",
    listed: true,
    unlocks: "Calendar sync",
  },
  zoom: {
    title: "Zoom",
    description: "Paste Zoom join links on calendar events. Auto-create meetings when Zoom OAuth ships.",
    tier: "live",
    icon: Video,
    setupMode: "manual",
    listed: false, // hidden until OAuth auto-create is finished product
    unlocks: "Zoom links on calendar events",
  },
  sms_channel: {
    title: "Text messaging",
    description: "Request setup — VIBETech buys the number and handles carrier approval. You only share business details.",
    tier: "live",
    icon: MessageSquare,
    setupMode: "api_key",
    listed: true,
    unlocks: "Business texting after carrier approval",
  },
  voice_channel: {
    title: "Business phone",
    description: "Request setup — VIBETech wires your business phone. Share your cell only if you want missed calls to ring you first.",
    tier: "live",
    icon: Phone,
    setupMode: "api_key",
    listed: true,
    unlocks: "AI receptionist · missed-call follow-up",
  },
  social_screening: {
    title: "Social screening",
    description: "Public social media search (Serper + ScrapingBee) → FCRA-filtered background report for review.",
    tier: "live",
    icon: Search,
    setupMode: "api_key",
    listed: false,
    unlocks: "Settings → Open Social Checker (social.vtechdevelopment.com)",
  },
  prospecting_enrichment: {
    title: "Prospecting enrichment",
    description: "Optional. AI Prospecting uses free public search for phones; paid Apollo/Hunter is not required for Find leads.",
    tier: "live",
    icon: Target,
    setupMode: "api_key",
    listed: false,
    unlocks: "Reserved for future paid enrichment — Find leads already requires a public phone",
  },
  meta_lead_ads: {
    title: "Meta Lead Forms",
    description: "Request setup — VIBETech connects your Facebook Lead Forms. You only share the Page name.",
    tier: "live",
    icon: Share2,
    setupMode: "api_key",
    listed: true,
    unlocks: "Lead → contact → Work + META_LEAD automations",
  },
  website_forms: {
    title: "Website forms",
    description: "Hosted intake form — prove with a test submission. Connected is not required; Proven needs a form_submission_id.",
    tier: "live",
    icon: ClipboardList,
    setupMode: "prove_only",
    listed: true,
    unlocks: "Form lead → contact + Work",
  },
  hubspot: {
    title: "HubSpot",
    description: "Request setup — VIBETech connects HubSpot with the right token. You don’t paste credentials.",
    tier: "live",
    icon: Database,
    setupMode: "api_key",
    listed: true,
    unlocks: "CRM updates with hubspot_record_id proof",
  },
  highlevel: {
    title: "HighLevel",
    description: "Request setup — VIBETech connects HighLevel for you. You don’t dig through API keys alone.",
    tier: "live",
    icon: Database,
    setupMode: "api_key",
    listed: true,
    unlocks: "CRM updates with highlevel_record_id proof",
  },
  salesforce: {
    title: "Salesforce",
    description: "Request setup — VIBETech scopes a Custom Build. There is no in-app token paste.",
    tier: "live",
    icon: Database,
    setupMode: "manual",
    listed: true,
    unlocks: "Custom Build / SOW delivery — not a fake Connected badge",
  },
  google_search_console: {
    title: "Google Search Console",
    description: "Read verified website search performance and SEO opportunities",
    tier: "live",
    icon: Search,
    setupMode: "oauth",
    listed: false,
  },
  google_ads: {
    title: "Google Ads",
    description: "Read ad performance and create approved campaign drafts",
    tier: "live",
    icon: Target,
    setupMode: "api_key",
    listed: false,
  },
  meta_ads: {
    title: "Meta Ads (campaigns)",
    description: "Read ad performance and create approved paused campaigns",
    tier: "live",
    icon: Share2,
    setupMode: "api_key",
    listed: false,
  },
  // Intentionally not listed until live connect exists:
  accounting: {
    title: "Accounting",
    description: "Connect your accounting software",
    tier: "live",
    icon: Calculator,
    listed: false,
  },
  document_storage: {
    title: "Documents",
    description: "Store leases, policies, and files",
    tier: "live",
    icon: FileText,
    listed: false,
  },
};

export type LiveIntegrationFlags = {
  business_email?: boolean;
  business_email_oauth?: boolean;
  calendar?: boolean;
  sms_channel?: boolean;
  voice_channel?: boolean;
  social_screening?: boolean;
  prospecting_enrichment?: boolean;
  meta_lead_ads?: boolean;
  google_search_console?: boolean;
  google_ads?: boolean;
  meta_ads?: boolean;
  property_management?: boolean;
  property_management_system?: boolean;
  hubspot?: boolean;
  highlevel?: boolean;
  salesforce?: boolean;
  website_forms?: boolean;
  _googleOAuth?: boolean;
  _microsoftOAuth?: boolean;
};

export function isIntegrationListed(
  connectionId: string,
  liveFlags: LiveIntegrationFlags = {},
  connectionStatus: string | null | undefined = null,
) {
  const id = String(connectionId);
  const config = INTEGRATION_CONFIG[id];
  if (!config) return true; // unknown required connections still surface
  const status = String(connectionStatus ?? "").toUpperCase();
  const alreadyPresent = ["CONNECTED", "VERIFIED", "PROVEN", "CONFIGURING", "NEEDS_ATTENTION", "ERROR", "DEGRADED"].includes(status);
  // Once a channel is on the install or required, never hide it after go-live.
  if (alreadyPresent) return true;
  if (id === "property_management_system") {
    return Boolean(liveFlags.property_management || liveFlags.property_management_system);
  }
  if (config.listed === false) {
    // Promote when the matching live provider app is configured.
    if (id === "calendar" || id === "business_email") {
      return Boolean(liveFlags.business_email || liveFlags.calendar || liveFlags._googleOAuth || liveFlags._microsoftOAuth);
    }
    if (id === "sms_channel") return Boolean(liveFlags.sms_channel);
    if (id === "voice_channel") return Boolean(liveFlags.voice_channel);
    if (id === "social_screening") return Boolean(liveFlags.social_screening);
    if (id === "prospecting_enrichment") return Boolean(liveFlags.prospecting_enrichment);
    if (id === "meta_lead_ads") return Boolean(liveFlags.meta_lead_ads);
    if (id === "google_search_console") return Boolean(liveFlags.google_search_console);
    if (id === "google_ads") return Boolean(liveFlags.google_ads);
    if (id === "meta_ads") return Boolean(liveFlags.meta_ads);
    return false;
  }
  // business_email / website_forms / hubspot / highlevel: always list when listed:true
  return true;
}

export function getIntegrationDisplay(
  connectionId: string,
  fallbackName?: string,
  liveFlags: LiveIntegrationFlags = {},
): IntegrationDisplay {
  const id = String(connectionId);
  const config = INTEGRATION_CONFIG[id];
  if (config) {
    let setupMode = config.setupMode;
    if (id === "business_email") {
      setupMode = (liveFlags.business_email_oauth || liveFlags._googleOAuth || liveFlags._microsoftOAuth) ? "oauth" : "dev_connect";
    }
    if ((id === "calendar") && (liveFlags.calendar || liveFlags._microsoftOAuth)) setupMode = "oauth";
    if (id === "sms_channel" && liveFlags.sms_channel) setupMode = "api_key";
    if (id === "voice_channel" && liveFlags.voice_channel) setupMode = "api_key";
    if (id === "social_screening" && liveFlags.social_screening) setupMode = "api_key";
    if (id === "prospecting_enrichment" && liveFlags.prospecting_enrichment) setupMode = "api_key";
    if (id === "meta_lead_ads" && liveFlags.meta_lead_ads) setupMode = "api_key";
    if (id === "google_search_console" && liveFlags.google_search_console) setupMode = "oauth";
    if (id === "google_ads" && liveFlags.google_ads) setupMode = "api_key";
    if (id === "meta_ads" && liveFlags.meta_ads) setupMode = "api_key";
    return {
      id,
      ...config,
      setupMode,
      listed: isIntegrationListed(id, liveFlags),
      microsoftOAuthAvailable: (id === "business_email" || id === "calendar") ? Boolean(liveFlags._microsoftOAuth) : false,
    };
  }
  return {
    id,
    title: String(fallbackName ?? id.replace(/_/g, " ")),
    description: "Connect this tool to your business",
    tier: "live",
    icon: Building2,
    listed: true,
  };
}

export function connectionStatusLabel(status: string): { label: string; tone: StatusBadgeTone } {
  const s = String(status).toUpperCase();
  if (s === "CONNECTED") return { label: "Connected", tone: "success" };
  if (s === "CONFIGURING") return { label: "In progress", tone: "info" };
  if (s === "NEEDS_ATTENTION" || s === "ERROR") return { label: "Needs setup", tone: "warning" };
  return { label: "Not connected", tone: "neutral" };
}

export function partitionConnections(connections: any[], liveFlags: LiveIntegrationFlags = {}) {
  const primary: Array<{ conn: any; display: IntegrationDisplay }> = [];

  for (const conn of connections) {
    if (!isIntegrationListed(String(conn.id), liveFlags, conn.status)) continue;
    const display = { ...getIntegrationDisplay(String(conn.id), conn.displayName, liveFlags), listed: true };
    primary.push({ conn, display });
  }

  return { primary, comingSoon: [] as Array<{ conn: any; display: IntegrationDisplay }> };
}
