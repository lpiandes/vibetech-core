import type { LucideIcon } from "lucide-react";
import { Building2, Calendar, Calculator, FileText, Mail, MessageSquare, Phone } from "lucide-react";

import type { StatusBadgeTone } from "@/components/product/StatusBadge";

export type IntegrationTier = "primary" | "coming_soon";

export type IntegrationDisplay = {
  id: string;
  title: string;
  description: string;
  tier: IntegrationTier;
  icon: LucideIcon;
  unlocks?: string;
  setupMode?: "manual" | "dev_connect";
};

const INTEGRATION_CONFIG: Record<string, Omit<IntegrationDisplay, "id">> = {
  business_email: {
    title: "Business email",
    description: "Send and receive email through VIBETech",
    tier: "primary",
    icon: Mail,
    setupMode: "dev_connect",
  },
  property_management_system: {
    title: "Property management software",
    description: "Sync properties, residents, leases, and work",
    tier: "primary",
    icon: Building2,
    setupMode: "manual",
  },
  sms_channel: {
    title: "Text messaging",
    description: "Send and receive text messages",
    tier: "coming_soon",
    icon: MessageSquare,
  },
  voice_channel: {
    title: "Phone",
    description: "Place and receive phone calls",
    tier: "coming_soon",
    icon: Phone,
  },
  calendar: {
    title: "Calendar",
    description: "Sync showings and appointments",
    tier: "coming_soon",
    icon: Calendar,
  },
  accounting: {
    title: "Accounting",
    description: "Connect your accounting software",
    tier: "coming_soon",
    icon: Calculator,
  },
  document_storage: {
    title: "Documents",
    description: "Store leases, policies, and files",
    tier: "coming_soon",
    icon: FileText,
  },
};

export function getIntegrationDisplay(connectionId: string, fallbackName?: string): IntegrationDisplay {
  const id = String(connectionId);
  const config = INTEGRATION_CONFIG[id];
  if (config) return { id, ...config };
  return {
    id,
    title: String(fallbackName ?? id.replace(/_/g, " ")),
    description: "Connect this tool to your business",
    tier: "primary",
    icon: Building2,
  };
}

export function connectionStatusLabel(status: string): { label: string; tone: StatusBadgeTone } {
  const s = String(status).toUpperCase();
  if (s === "CONNECTED") return { label: "Connected", tone: "success" };
  if (s === "CONFIGURING") return { label: "In progress", tone: "info" };
  if (s === "NEEDS_ATTENTION" || s === "ERROR") return { label: "Needs setup", tone: "warning" };
  return { label: "Not connected", tone: "neutral" };
}

export function partitionConnections(connections: any[]) {
  const primary: Array<{ conn: any; display: IntegrationDisplay }> = [];
  const comingSoon: Array<{ conn: any; display: IntegrationDisplay }> = [];

  for (const conn of connections) {
    const display = getIntegrationDisplay(String(conn.id), conn.displayName);
    if (display.tier === "coming_soon") {
      comingSoon.push({ conn, display });
    } else {
      primary.push({ conn, display });
    }
  }

  return { primary, comingSoon };
}
