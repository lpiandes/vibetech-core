"use client";

import ShellMetricStrip from "@/components/shell/ShellMetricStrip";
import ShellPanel from "@/components/shell/ShellPanel";
import StatusBadge from "@/components/product/StatusBadge";
import { cockpitColors, spacing, typography } from "@/design/tokens";
import {
  Tables,
  DataGrid,
  StatusBadges,
  InsightCards,
  Filters,
} from "@/components/universal";

type IntegrationView = {
  hasIntegrations: boolean;
  connections: Array<{
    id: string;
    providerId: string;
    label: string;
    category: string;
    status: string;
    authMethod: string;
    capabilities: string[];
    lastSyncAt?: string | null;
    setupGuide?: string;
    permissions?: string[];
    errorHistory?: unknown[];
    logs?: unknown[];
    rateLimitPerMinute?: number | null;
    recommended?: boolean;
  }>;
  healthSummary: {
    connected: number;
    needsAttention: number;
    disconnected: number;
    error: number;
  };
  capabilities: Array<{ id: string; label: string; providers: string[] }>;
  syncHistory: Array<{ id: string; label: string; detail?: string }>;
  logs: Array<{ id: string; label: string; detail?: string }>;
  metrics: Array<{ id: string; label: string; value: string | number }>;
};

function toneForStatus(status: string) {
  if (status === "connected") return "success" as const;
  if (status === "error") return "warning" as const;
  if (/attention|syncing|paused/.test(status)) return "warning" as const;
  return "neutral" as const;
}

/**
 * Integrations workspace — connections, health, capabilities, logs.
 * Visual only — never exposes secrets or raw credential JSON.
 */
export default function IntegrationWorkspace({ integrations }: { integrations: IntegrationView }) {
  if (!integrations?.hasIntegrations) {
    return (
      <ShellPanel title="Integrations" subtitle="Connections">
        <div style={{ padding: spacing.md, color: cockpitColors.textMuted, lineHeight: 1.5 }}>
          Architect will recommend providers by capability during discovery. Connect when ready —
          nothing is linked silently.
        </div>
      </ShellPanel>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: spacing.md }}>
      <ShellMetricStrip metrics={integrations.metrics as never} />

      <ShellPanel title="Health" subtitle="Connected · attention · errors">
        <StatusBadges items={[
          { id: "connected", label: `Connected ${integrations.healthSummary.connected}` },
          { id: "attention", label: `Needs attention ${integrations.healthSummary.needsAttention}` },
          { id: "disconnected", label: `Disconnected ${integrations.healthSummary.disconnected}` },
          { id: "error", label: `Error ${integrations.healthSummary.error}` },
        ]} />
      </ShellPanel>

      <ShellPanel title="Connections" subtitle="Connect · disconnect · reconnect · test">
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: spacing.md,
        }}>
          {integrations.connections.map((connection) => (
            <div
              key={connection.id}
              style={{
                border: `1px solid ${cockpitColors.panelBorder}`,
                borderRadius: 12,
                padding: spacing.md,
                background: cockpitColors.panel,
                display: "flex",
                flexDirection: "column",
                gap: spacing.sm,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: spacing.sm, alignItems: "center" }}>
                <div>
                  <div style={{ fontWeight: 650 }}>{connection.label}</div>
                  <div style={{ color: cockpitColors.textMuted, fontSize: typography.caption.fontSize }}>
                    {connection.category} · {connection.authMethod}
                  </div>
                </div>
                <StatusBadge label={connection.status.replace(/_/g, " ")} tone={toneForStatus(connection.status)} />
              </div>
              <Filters items={connection.capabilities.map((capability) => ({
                id: `${connection.id}_${capability}`,
                label: capability.replace(/_/g, " "),
              }))} />
              {connection.setupGuide ? (
                <div style={{ color: cockpitColors.textMuted, fontSize: typography.caption.fontSize, lineHeight: 1.45 }}>
                  {connection.setupGuide}
                </div>
              ) : null}
              <div style={{ color: cockpitColors.textMuted, fontSize: typography.caption.fontSize }}>
                Last sync: {connection.lastSyncAt ? String(connection.lastSyncAt) : "Never"}
                {connection.rateLimitPerMinute != null ? ` · Rate limit ${connection.rateLimitPerMinute}/min` : ""}
              </div>
            </div>
          ))}
        </div>
      </ShellPanel>

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
        gap: spacing.md,
      }}>
        <ShellPanel title="Capabilities" subtitle="Architect routes by capability">
          <InsightCards items={(integrations.capabilities.length
            ? integrations.capabilities
            : integrations.connections.flatMap((connection) => connection.capabilities.map((capability) => ({
              id: `${connection.id}_${capability}`,
              label: capability.replace(/_/g, " "),
              providers: [connection.label],
            })))
          ).slice(0, 8).map((entry) => ({
            id: entry.id,
            label: entry.label,
            summary: Array.isArray(entry.providers) ? entry.providers.join(", ") : "",
          }))} />
        </ShellPanel>

        <ShellPanel title="Sync history" subtitle="Recent activity">
          <DataGrid
            items={integrations.syncHistory.length
              ? integrations.syncHistory.map((entry) => ({
                id: entry.id,
                label: entry.label,
                status: entry.detail ?? "",
              }))
              : integrations.connections.slice(0, 6).map((connection) => ({
                id: connection.id,
                label: connection.label,
                status: connection.lastSyncAt ?? "Not synced",
              }))}
            columns={[
              { id: "label", label: "Connection" },
              { id: "status", label: "Last sync" },
            ]}
          />
        </ShellPanel>

        <ShellPanel title="Permissions" subtitle="Scopes — never secrets">
          <Tables
            items={integrations.connections.map((connection) => ({
              id: connection.id,
              name: connection.label,
              scopes: (connection.permissions ?? []).slice(0, 3).join(", ") || "basic",
            }))}
            columns={[
              { id: "name", label: "Provider" },
              { id: "scopes", label: "Scopes" },
            ]}
          />
        </ShellPanel>
      </div>

      <ShellPanel title="Logs" subtitle="Operational messages only">
        {integrations.logs.length ? (
          <DataGrid
            items={integrations.logs.slice(0, 10).map((entry) => ({
              id: entry.id,
              label: entry.label,
              status: entry.detail ?? "",
            }))}
            columns={[
              { id: "label", label: "Provider" },
              { id: "status", label: "Message" },
            ]}
          />
        ) : (
          <div style={{ color: cockpitColors.textMuted, padding: spacing.sm }}>
            No logs yet. Test a connection to generate operational messages. Secrets are never logged.
          </div>
        )}
      </ShellPanel>
    </div>
  );
}
