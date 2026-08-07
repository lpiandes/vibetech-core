import type { StatusBadgeTone } from "@/components/product/StatusBadge";
import type { IntegrationDisplay, IntegrationSetupMode, IntegrationTier, LiveIntegrationFlags } from "./integrationDisplay.ts";
import { isIntegrationListed } from "./integrationDisplay.ts";

export type ConnectionViewRow = {
  id: string;
  displayName?: string;
  purpose?: string;
  requirementLevel?: string;
  status?: string;
  health?: { level?: string; label?: string; message?: string; detail?: string } | null;
  healthLabel?: string | null;
  healthDetail?: string | null;
  unlockMessage?: string | null;
  enables?: {
    employees?: Array<{ id?: string; name?: string } | string>;
    capabilities?: string[];
    communicationIntents?: string[];
  };
  blockedWithout?: {
    employees?: Array<{ id?: string; name?: string } | string>;
    capabilities?: string[];
  };
  availableActions?: Array<{ id: string; label: string; supported: boolean; reason?: string | null }>;
};

export type IntegrationsPresentation = {
  connectionLabels?: Record<
    string,
    {
      title?: string;
      purpose?: string;
      unlocks?: string;
      tier?: IntegrationTier;
      setupMode?: IntegrationSetupMode;
    }
  >;
  statusLabels?: Record<string, string>;
  requirementLabels?: Record<string, string>;
  emptyStates?: {
    required?: string;
    connected?: string;
    available?: string;
  };
  liveFlags?: LiveIntegrationFlags;
};

function safeArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

export function isConnectionConnected(status: string) {
  return String(status ?? "").toUpperCase() === "CONNECTED";
}

export function connectionStatusPresentation(
  status: string,
  presentation: IntegrationsPresentation = {},
): { label: string; tone: StatusBadgeTone } {
  const key = String(status ?? "").toUpperCase();
  const labels = presentation.statusLabels ?? {};
  if (key === "CONNECTED") return { label: labels.CONNECTED ?? "Connected", tone: "success" };
  if (key === "CONFIGURING") return { label: labels.CONFIGURING ?? "In progress", tone: "info" };
  if (key === "DEGRADED" || key === "ERROR") return { label: labels[key] ?? "Needs attention", tone: "warning" };
  if (key === "DISCONNECTED") return { label: labels.DISCONNECTED ?? "Disconnected", tone: "warning" };
  return { label: labels.NOT_CONNECTED ?? "Not connected", tone: "neutral" };
}

export function requirementLevelLabel(level: string, presentation: IntegrationsPresentation = {}) {
  const key = String(level ?? "optional").toLowerCase();
  return presentation.requirementLabels?.[key] ?? key.replace(/_/g, " ");
}

export function deriveIntegrationMetrics(connections: unknown, presentation: IntegrationsPresentation = {}) {
  const liveFlags = presentation.liveFlags ?? {};
  const rows = safeArray<ConnectionViewRow>(connections).filter((row) =>
    isIntegrationListed(String(row.id), liveFlags, row.status),
  );
  const connected = rows.filter((row) => isConnectionConnected(String(row.status ?? ""))).length;
  const required = rows.filter((row) => String(row.requirementLevel ?? "").toLowerCase() === "required").length;
  const needsSetup = rows.filter((row) => connectionNeedsSetup(row)).length;
  const optionalOrSoon = rows.filter((row) => {
    const level = String(row.requirementLevel ?? "").toLowerCase();
    return level !== "required" && !isConnectionConnected(String(row.status ?? ""));
  }).length;

  const metrics = [
    { id: "connected", label: "Connected", value: String(connected) },
    { id: "needs_setup", label: "Needs setup", value: String(needsSetup) },
    { id: "required", label: "Required", value: String(required) },
  ];

  if (optionalOrSoon > 0) {
    metrics.push({ id: "optional", label: "Optional", value: String(optionalOrSoon) });
  }

  return { connected, needsSetup, required, optionalOrSoon, metrics };
}

export function connectionNeedsSetup(row: ConnectionViewRow) {
  if (isConnectionConnected(String(row.status ?? ""))) return false;
  const level = String(row.requirementLevel ?? "").toLowerCase();
  const status = String(row.status ?? "").toUpperCase();
  if (level === "required") return true;
  return status === "ERROR" || status === "DEGRADED";
}

export function mergeIntegrationDisplay(
  connectionId: string,
  fallbackName: string | undefined,
  baseDisplay: IntegrationDisplay,
  presentation: IntegrationsPresentation = {},
): IntegrationDisplay {
  const overlay = presentation.connectionLabels?.[connectionId];
  if (!overlay) return baseDisplay;
  return {
    ...baseDisplay,
    title: overlay.title ?? baseDisplay.title,
    description: overlay.purpose ?? baseDisplay.description,
    tier: overlay.tier ?? baseDisplay.tier,
    unlocks: overlay.unlocks ?? baseDisplay.unlocks,
    setupMode: overlay.setupMode ?? baseDisplay.setupMode,
  };
}

export function partitionIntegrationSections(
  connections: unknown,
  resolveDisplay: (row: ConnectionViewRow) => IntegrationDisplay,
  liveFlags: LiveIntegrationFlags = {},
) {
  const rows = safeArray<ConnectionViewRow>(connections).filter((row) =>
    isIntegrationListed(String(row.id), liveFlags, row.status),
  );
  const required: Array<{ conn: ConnectionViewRow; display: IntegrationDisplay }> = [];
  const connected: Array<{ conn: ConnectionViewRow; display: IntegrationDisplay }> = [];
  const available: Array<{ conn: ConnectionViewRow; display: IntegrationDisplay }> = [];
  const roadmap: Array<{ conn: ConnectionViewRow; display: IntegrationDisplay }> = [];

  for (const conn of rows) {
    const display = { ...resolveDisplay(conn), listed: true };
    const item = { conn, display };
    if (String(conn.requirementLevel ?? "").toLowerCase() === "required"
      && !isConnectionConnected(String(conn.status ?? ""))) {
      required.push(item);
    }
    if (isConnectionConnected(String(conn.status ?? ""))) {
      connected.push(item);
    }
    const isOptional = String(conn.requirementLevel ?? "").toLowerCase() !== "required"
      && !isConnectionConnected(String(conn.status ?? ""));
    if (!isOptional) continue;
    available.push(item);
  }

  return { required, connected, available, roadmap };
}

export function blockedEmployeeNames(conn: ConnectionViewRow) {
  return safeArray<{ id?: string; name?: string } | string>(conn.blockedWithout?.employees)
    .map((employee) => (typeof employee === "string" ? employee : String(employee.name ?? employee.id ?? "")))
    .filter(Boolean);
}

export function primaryIntegrationAction(conn: ConnectionViewRow, display: IntegrationDisplay) {
  if (display.listed === false) return null;

  const healthLevel = String(conn.health?.level ?? "").toUpperCase();
  const reconnectAction = safeArray<{ id: string; label: string; supported: boolean }>(conn.availableActions).find(
    (action) => String(action.id) === "reconnect" && action.supported !== false,
  );
  const needsReconnect =
    healthLevel === "ERROR"
    || healthLevel === "NEEDS_ATTENTION"
    || healthLevel === "DISCONNECTED"
    || Boolean(reconnectAction);

  // Connectionless prove (website forms) — offer prove before Connected.
  if (display.setupMode === "prove_only") {
    const prove = proveActionForConnection(String(conn.id));
    if (prove) {
      return { kind: "prove" as const, label: "Prove it works", proveAction: prove.action, capabilityId: prove.capabilityId };
    }
  }

  if (isConnectionConnected(String(conn.status ?? ""))) {
    if (needsReconnect && (display.setupMode === "oauth" || display.setupMode === "api_key" || display.setupMode === "dev_connect")) {
      return { kind: "connect" as const, label: reconnectAction?.label ?? "Reconnect" };
    }
    const prove = proveActionForConnection(String(conn.id));
    if (prove) return { kind: "prove" as const, label: "Prove it works", proveAction: prove.action, capabilityId: prove.capabilityId };
    return null;
  }

  if (display.setupMode === "oauth" || display.setupMode === "api_key" || display.setupMode === "dev_connect") {
    const label =
      display.setupMode === "oauth"
        ? display.id === "business_email" || display.id === "calendar"
          ? "Connect with Google"
          : display.id === "meta_lead_ads"
            ? "Request setup"
            : "Connect"
        : display.setupMode === "api_key"
          ? "Connect"
          : "Connect";
    return { kind: "connect" as const, label };
  }

  if (display.setupMode === "manual") {
    return { kind: "connect" as const, label: "How it works" };
  }

  if (display.id === "business_email") {
    return { kind: "connect" as const, label: "Connect" };
  }

  return { kind: "manual" as const, label: "We'll set this up with you" };
}

export function proveActionForConnection(connectionId: string): { action: string; capabilityId: string } | null {
  const map: Record<string, { action: string; capabilityId: string }> = {
    business_email: { action: "send_test_email", capabilityId: "customer_email_send" },
    calendar: { action: "create_test_event", capabilityId: "calendar_scheduling" },
    sms_channel: { action: "send_test_sms", capabilityId: "sms_send" },
    meta_lead_ads: { action: "ingest_test_lead", capabilityId: "meta_lead_intake" },
    website_forms: { action: "submit_test_form", capabilityId: "website_forms" },
    hubspot: { action: "sync_test_crm_contact", capabilityId: "crm_hubspot" },
    highlevel: { action: "sync_test_crm_contact", capabilityId: "crm_highlevel" },
  };
  return map[String(connectionId)] ?? null;
}

export function hasRealConnectAction(conn: ConnectionViewRow, display: IntegrationDisplay) {
  return primaryIntegrationAction(conn, display)?.kind === "connect";
}

export function setupBlockerSummary(conn: ConnectionViewRow, display: IntegrationDisplay) {
  const blocked = blockedEmployeeNames(conn);
  if (blocked.length > 0) {
    return `Needed for ${blocked.join(", ")}`;
  }
  if (!isConnectionConnected(String(conn.status ?? "")) && display.unlocks) {
    return display.unlocks;
  }
  return null;
}
