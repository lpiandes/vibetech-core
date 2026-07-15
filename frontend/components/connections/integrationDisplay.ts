import type { LucideIcon } from "lucide-react";
import { Building2, Calendar, Calculator, FileText, Mail, MessageSquare, Phone, Share2 } from "lucide-react";

import type { StatusBadgeTone } from "@/components/product/StatusBadge";

/** Only `live` integrations are listed. Unavailable channels are omitted entirely. */
export type IntegrationTier = "live";

export type IntegrationSetupMode = "manual" | "dev_connect" | "oauth" | "api_key";

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
};

const INTEGRATION_CONFIG: Record<string, Omit<IntegrationDisplay, "id">> = {
  business_email: {
    title: "Business email",
    description: "Send and receive email through your Gmail account",
    tier: "live",
    icon: Mail,
    setupMode: "oauth",
    listed: true,
  },
  property_management_system: {
    title: "Property management software",
    description: "Sync properties, residents, leases, and work",
    tier: "live",
    icon: Building2,
    setupMode: "manual",
    listed: true,
  },
  calendar: {
    title: "Calendar",
    description: "Create and update appointments on Google Calendar",
    tier: "live",
    icon: Calendar,
    setupMode: "oauth",
    listed: false, // promoted when Google OAuth app is configured (see isIntegrationListed)
  },
  sms_channel: {
    title: "Text messaging",
    description: "Send approved text messages through Twilio",
    tier: "live",
    icon: MessageSquare,
    setupMode: "api_key",
    listed: false,
  },
  voice_channel: {
    title: "Phone",
    description: "Place approved calls through Twilio Voice",
    tier: "live",
    icon: Phone,
    setupMode: "api_key",
    listed: false,
  },
  meta_lead_ads: {
    title: "Facebook Lead Ads",
    description: "Ingest Facebook lead form submissions into intake",
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
  meta_lead_ads?: boolean;
  _googleOAuth?: boolean;
};

export function isIntegrationListed(connectionId: string, liveFlags: LiveIntegrationFlags = {}) {
  const id = String(connectionId);
  const config = INTEGRATION_CONFIG[id];
  if (!config) return true; // unknown required connections still surface
  if (config.listed === false) {
    // Promote when the matching live provider app is configured.
    if (id === "calendar" || id === "business_email") return Boolean(liveFlags.business_email || liveFlags.calendar);
    if (id === "sms_channel") return Boolean(liveFlags.sms_channel);
    if (id === "voice_channel") return Boolean(liveFlags.voice_channel);
    if (id === "meta_lead_ads") return Boolean(liveFlags.meta_lead_ads);
    return false;
  }
  // business_email: always list (oauth when configured, else dev_connect when allowed)
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
      setupMode = (liveFlags.business_email_oauth || liveFlags._googleOAuth) ? "oauth" : "dev_connect";
    }
    if ((id === "calendar") && liveFlags.calendar) setupMode = "oauth";
    if (id === "sms_channel" && liveFlags.sms_channel) setupMode = "api_key";
    if (id === "voice_channel" && liveFlags.voice_channel) setupMode = "api_key";
    if (id === "meta_lead_ads" && liveFlags.meta_lead_ads) setupMode = "api_key";
    return {
      id,
      ...config,
      setupMode,
      listed: isIntegrationListed(id, liveFlags),
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
    const display = getIntegrationDisplay(String(conn.id), conn.displayName, liveFlags);
    if (!display.listed) continue;
    primary.push({ conn, display });
  }

  return { primary, comingSoon: [] as Array<{ conn: any; display: IntegrationDisplay }> };
}
