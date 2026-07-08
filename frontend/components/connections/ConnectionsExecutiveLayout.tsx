"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { useConnectionsViewModel } from "./ConnectionsContext";
import IntegrationSetupDialog from "./IntegrationSetupDialog";
import { getIntegrationDisplay } from "./integrationDisplay";
import { buildPathWithoutFocus, shouldOpenIntegrationFromFocus } from "@/lib/connections/integrationFocusRouting.js";
import PageHeader from "@/components/product/PageHeader";
import PrimaryButton from "@/components/product/PrimaryButton";
import StatusBadge from "@/components/product/StatusBadge";
import ShellMetricStrip from "@/components/shell/ShellMetricStrip";
import ShellPanel from "@/components/shell/ShellPanel";
import { cockpitColors, spacing, typography, radius } from "@/design/tokens";
import {
  connectionStatusPresentation,
  deriveIntegrationMetrics,
  hasRealConnectAction,
  mergeIntegrationDisplay,
  partitionIntegrationSections,
  primaryIntegrationAction,
  requirementLevelLabel,
  setupBlockerSummary,
  type ConnectionViewRow,
  type IntegrationsPresentation,
} from "./integrationsSemantics";
import type { IntegrationDisplay } from "./integrationDisplay";

function safeArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function PanelEmpty({ description }: { description: string }) {
  return (
    <div style={{ padding: spacing.md, color: cockpitColors.textMuted, fontSize: typography.caption.fontSize, lineHeight: 1.5 }}>
      {description}
    </div>
  );
}

function IntegrationRow({
  conn,
  display,
  presentation,
  onAction,
}: {
  conn: ConnectionViewRow;
  display: IntegrationDisplay;
  presentation: IntegrationsPresentation;
  onAction: (display: IntegrationDisplay) => void;
}) {
  const Icon = display.icon;
  const status = connectionStatusPresentation(String(conn.status ?? ""), presentation);
  const action = primaryIntegrationAction(conn, display);
  const blocker = setupBlockerSummary(conn, display);
  const requirement = requirementLevelLabel(String(conn.requirementLevel ?? ""), presentation);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: spacing.md,
        padding: spacing.md,
        borderBottom: `1px solid ${cockpitColors.panelBorder}`,
      }}
    >
      <span
        style={{
          width: 36,
          height: 36,
          borderRadius: radius.medium,
          backgroundColor: cockpitColors.panelElevated,
          color: cockpitColors.accent,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <Icon size={18} />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: spacing.sm, flexWrap: "wrap" }}>
          <div style={{ fontWeight: 650, color: cockpitColors.textPrimary }}>{display.title}</div>
          <StatusBadge label={status.label} tone={status.tone} />
          {String(conn.requirementLevel ?? "").toLowerCase() === "required" ? (
            <StatusBadge label={requirement} tone="warning" />
          ) : null}
          {display.tier === "coming_soon" ? <StatusBadge label="Coming soon" tone="neutral" /> : null}
        </div>
        <div style={{ fontSize: typography.caption.fontSize, color: cockpitColors.textSecondary, marginTop: 4, lineHeight: 1.45 }}>
          {display.description}
        </div>
        {display.unlocks ? (
          <div style={{ fontSize: typography.caption.fontSize, color: cockpitColors.textMuted, marginTop: 6 }}>
            Unlocks: {display.unlocks}
          </div>
        ) : null}
        {blocker ? (
          <div style={{ fontSize: typography.caption.fontSize, color: cockpitColors.textSecondary, marginTop: 6 }}>
            {blocker}
          </div>
        ) : null}
      </div>
      {action ? (
        <PrimaryButton onClick={() => onAction(display)}>
          {action.label}
        </PrimaryButton>
      ) : null}
    </div>
  );
}

export default function ConnectionsExecutiveLayout() {
  const vm = useConnectionsViewModel();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const connections = safeArray<ConnectionViewRow>(vm?.connections);
  const presentation = ((vm?.productContext?.installationResult?.executiveExperience?.dashboardPresentation ??
    vm?.productContext?.installationResult?.dashboardPresentation ??
    {}) as { integrations?: IntegrationsPresentation }).integrations ?? {};
  const [setupTarget, setSetupTarget] = useState<IntegrationDisplay | null>(null);
  const consumedFocusRef = useRef<string | null>(null);

  const resolveDisplay = useCallback(
    (conn: ConnectionViewRow) =>
      mergeIntegrationDisplay(
        String(conn.id),
        conn.displayName,
        getIntegrationDisplay(String(conn.id), conn.displayName),
        presentation,
      ),
    [presentation],
  );

  const sections = useMemo(() => partitionIntegrationSections(connections, resolveDisplay), [connections, resolveDisplay]);
  const metrics = useMemo(() => deriveIntegrationMetrics(connections, presentation).metrics, [connections, presentation]);

  const dismissSetupDialog = useCallback(() => {
    setSetupTarget(null);
    if (searchParams.get("focus")) {
      router.replace(buildPathWithoutFocus(pathname, searchParams), { scroll: false });
    }
  }, [pathname, router, searchParams]);

  useEffect(() => {
    const focus = searchParams.get("focus");
    if (!focus) {
      consumedFocusRef.current = null;
      return;
    }

    const primary = [...sections.required, ...sections.available];
    const display = shouldOpenIntegrationFromFocus({
      focus,
      setupTarget,
      consumedFocus: consumedFocusRef.current,
      primary,
      isConnected: (status: string) => connectionStatusPresentation(status, presentation).label === "Connected",
    });

    if (display) {
      consumedFocusRef.current = focus;
      setSetupTarget(display);
    }
  }, [searchParams, sections.required, sections.available, setupTarget, presentation]);

  const emptyRequired = presentation.emptyStates?.required;
  const emptyConnected = presentation.emptyStates?.connected;
  const emptyAvailable = presentation.emptyStates?.available;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: spacing.md, paddingBottom: spacing.xl }}>
      <PageHeader
        title="Integrations"
        description="Connect the systems VIBETech uses to operate this business."
      />

      <ShellMetricStrip metrics={metrics} />

      <ShellPanel title="Required connections" subtitle={`${sections.required.length} required`}>
        {sections.required.length === 0 ? (
          <PanelEmpty description={emptyRequired ?? "Required connections will appear here for your business package."} />
        ) : (
          <div>
            {sections.required.map(({ conn, display }) => (
              <IntegrationRow
                key={display.id}
                conn={conn}
                display={display}
                presentation={presentation}
                onAction={setSetupTarget}
              />
            ))}
          </div>
        )}
      </ShellPanel>

      <ShellPanel title="Connected systems" subtitle={`${sections.connected.length} connected`}>
        {sections.connected.length === 0 ? (
          <PanelEmpty description={emptyConnected ?? "Connected systems will appear here once setup is complete."} />
        ) : (
          <div>
            {sections.connected.map(({ conn, display }) => (
              <IntegrationRow
                key={`connected_${display.id}`}
                conn={conn}
                display={display}
                presentation={presentation}
                onAction={setSetupTarget}
              />
            ))}
          </div>
        )}
      </ShellPanel>

      <ShellPanel title="Available and coming soon" subtitle={`${sections.available.length} available`}>
        {sections.available.length === 0 ? (
          <PanelEmpty description={emptyAvailable ?? "Additional integrations will appear here as they become available."} />
        ) : (
          <div>
            {sections.available.map(({ conn, display }) => (
              <IntegrationRow
                key={`available_${display.id}`}
                conn={conn}
                display={display}
                presentation={presentation}
                onAction={setSetupTarget}
              />
            ))}
          </div>
        )}
      </ShellPanel>

      {setupTarget ? (
        <IntegrationSetupDialog
          integration={setupTarget}
          hasRealConnect={(() => {
            const match = [...sections.required, ...sections.available].find(({ display }) => display.id === setupTarget.id);
            return match ? hasRealConnectAction(match.conn, match.display) : false;
          })()}
          onClose={dismissSetupDialog}
        />
      ) : null}
    </div>
  );
}
