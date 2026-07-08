import type { StatusBadgeTone } from "@/components/product/StatusBadge";
import type { IntegrationDisplay, IntegrationTier } from "./integrationDisplay";

export type ConnectionViewRow = {
  id: string;
  displayName?: string;
  purpose?: string;
  requirementLevel?: string;
  status?: string;
  enables?: {
    employees?: Array<{ id?: string; name?: string } | string>;
    capabilities?: string[];
    communicationIntents?: string[];
  };
  blockedWithout?: {
    employees?: Array<{ id?: string; name?: string } | string>;
    capabilities?: string[];
  };
  availableActions?: Array<{ id: string; label: string; supported: boolean; reason?: string }>;
};

export type IntegrationsPresentation = {
  connectionLabels?: Record<
    string,
    {
      title?: string;
      purpose?: string;
      unlocks?: string;
      tier?: IntegrationTier;
      setupMode?: "manual" | "dev_connect";
    }
  >;
  statusLabels?: Record<string, string>;
  requirementLabels?: Record<string, string>;
  emptyStates?: {
    required?: string;
    connected?: string;
    available?: string;
  };
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
  const rows = safeArray<ConnectionViewRow>(connections);
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

  void presentation;
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
) {
  const rows = safeArray<ConnectionViewRow>(connections);
  const required: Array<{ conn: ConnectionViewRow; display: IntegrationDisplay }> = [];
  const connected: Array<{ conn: ConnectionViewRow; display: IntegrationDisplay }> = [];
  const available: Array<{ conn: ConnectionViewRow; display: IntegrationDisplay }> = [];

  for (const conn of rows) {
    const display = resolveDisplay(conn);
    const item = { conn, display };
    if (String(conn.requirementLevel ?? "").toLowerCase() === "required") {
      required.push(item);
    }
    if (isConnectionConnected(String(conn.status ?? ""))) {
      connected.push(item);
    }
    if (String(conn.requirementLevel ?? "").toLowerCase() !== "required" && !isConnectionConnected(String(conn.status ?? ""))) {
      available.push(item);
    }
  }

  return { required, connected, available };
}

export function blockedEmployeeNames(conn: ConnectionViewRow) {
  return safeArray<{ id?: string; name?: string } | string>(conn.blockedWithout?.employees)
    .map((employee) => (typeof employee === "string" ? employee : String(employee.name ?? employee.id ?? "")))
    .filter(Boolean);
}

export function primaryIntegrationAction(conn: ConnectionViewRow, display: IntegrationDisplay) {
  if (isConnectionConnected(String(conn.status ?? ""))) return null;
  if (display.tier === "coming_soon") return null;

  if (display.id === "business_email" || display.setupMode === "dev_connect") {
    return { kind: "connect" as const, label: "Connect" };
  }

  return { kind: "manual" as const, label: "We'll set this up with you" };
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
