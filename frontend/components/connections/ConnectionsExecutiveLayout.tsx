"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { useConnectionsViewModel } from "./ConnectionsContext";
import IntegrationSetupDialog from "./IntegrationSetupDialog";
import { getIntegrationDisplay } from "./integrationDisplay";
import { buildPathWithoutFocus, resolveOAuthReturnPath, shouldOpenIntegrationFromFocus } from "@/lib/connections/integrationFocusRouting.js";
import PageHeader from "@/components/product/PageHeader";
import PrimaryButton from "@/components/product/PrimaryButton";
import { NextBanner, SimpleEmpty, SimplePanel, simplePageStyle } from "@/components/product/SimpleUI";
import StatusBadge from "@/components/product/StatusBadge";
import { cockpitColors, spacing, typography, radius } from "@/design/tokens";
import { useOptionalBusinessScope } from "@/lib/platform/BusinessScopeContext";
import {
  connectionStatusPresentation,
  hasRealConnectAction,
  mergeIntegrationDisplay,
  partitionIntegrationSections,
  primaryIntegrationAction,
  setupBlockerSummary,
  type ConnectionViewRow,
  type IntegrationsPresentation,
} from "./integrationsSemantics";
import type { IntegrationDisplay } from "./integrationDisplay";

function safeArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function IntegrationRow({
  conn,
  display,
  presentation,
  businessId,
  onAction,
  onProve,
  proving,
}: {
  conn: ConnectionViewRow;
  display: IntegrationDisplay;
  presentation: IntegrationsPresentation;
  businessId?: string;
  onAction: (display: IntegrationDisplay) => void;
  onProve?: (action: string, capabilityId: string) => void;
  proving?: boolean;
}) {
  const Icon = display.icon;
  const status = connectionStatusPresentation(String(conn.status ?? ""), presentation);
  const action = primaryIntegrationAction(conn, display);
  const blocker = setupBlockerSummary(conn, display);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
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
        </div>
        {blocker ? (
          <div style={{ fontSize: typography.caption.fontSize, color: cockpitColors.textMuted, marginTop: 4 }}>
            {blocker}
          </div>
        ) : null}
      </div>
      {action?.kind === "prove" && onProve && businessId ? (
        <PrimaryButton onClick={() => onProve(action.proveAction!, action.capabilityId!)} disabled={proving}>
          {proving ? "Proving…" : action.label}
        </PrimaryButton>
      ) : action ? (
        <PrimaryButton onClick={() => onAction(display)}>
          {action.label}
        </PrimaryButton>
      ) : null}
    </div>
  );
}

export default function ConnectionsExecutiveLayout() {
  const vm = useConnectionsViewModel();
  const scope = useOptionalBusinessScope();
  const businessId = String(scope?.businessId ?? vm?.businessId ?? "");
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const connections = safeArray<ConnectionViewRow>(vm?.connections);
  const presentation = ((vm?.productContext?.installationResult?.executiveExperience?.dashboardPresentation ??
    vm?.productContext?.installationResult?.dashboardPresentation ??
    {}) as { integrations?: IntegrationsPresentation }).integrations ?? {};
  const liveFlags = (vm?.liveFlags ?? presentation.liveFlags ?? {}) as IntegrationsPresentation["liveFlags"];
  const presentationWithFlags: IntegrationsPresentation = { ...presentation, liveFlags };
  const [setupTarget, setSetupTarget] = useState<IntegrationDisplay | null>(null);
  const [provingId, setProvingId] = useState<string | null>(null);
  const [proveMessage, setProveMessage] = useState<string | null>(null);
  const consumedFocusRef = useRef<string | null>(null);
  const connectError = searchParams.get("error");
  const justConnected = searchParams.get("connected") === "1";
  const connectErrorMessage = useMemo(() => {
    if (!connectError) return null;
    if (connectError === "access_denied") {
      return null; // rendered as rich banner below
    }
    if (connectError === "missing_refresh_token") {
      return "Google did not return a reusable connection. Try again, approve the requested access, and choose the intended customer inbox.";
    }
    return `Could not finish connecting: ${connectError}`;
  }, [connectError]);

  const [localConnecting, setLocalConnecting] = useState(false);

  async function connectEmailLocally() {
    if (!businessId) return;
    setLocalConnecting(true);
    try {
      const res = await fetch(`/api/businesses/${encodeURIComponent(businessId)}/integrations/business-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "dev" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setProveMessage(String(data.error ?? "Could not connect email locally."));
        return;
      }
      router.replace(`/b/${businessId}/integrations?connected=1&focus=business_email`);
      router.refresh();
    } catch (err) {
      setProveMessage(err instanceof Error ? err.message : "Local connect failed.");
    } finally {
      setLocalConnecting(false);
    }
  }

  const runProve = useCallback(
    async (action: string, capabilityId: string) => {
      if (!businessId) return;
      setProvingId(capabilityId);
      setProveMessage(null);
      try {
        const res = await fetch(`/api/businesses/${encodeURIComponent(businessId)}/integrations/prove`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, capabilityId, outboundApproved: true }),
        });
        const body = await res.json().catch(() => ({}));
        const ok = Boolean(body?.result?.ok);
        setProveMessage(ok ? (body?.result?.message ?? "Proven.") : (body?.result?.message ?? "Prove failed."));
        if (ok) {
          router.refresh();
        }
      } catch (err) {
        setProveMessage(err instanceof Error ? err.message : "Prove failed.");
      } finally {
        setProvingId(null);
      }
    },
    [businessId, router],
  );
  const resolveDisplay = useCallback(
    (conn: ConnectionViewRow) =>
      mergeIntegrationDisplay(
        String(conn.id),
        conn.displayName,
        getIntegrationDisplay(String(conn.id), conn.displayName, liveFlags ?? {}),
        presentationWithFlags,
      ),
    [presentationWithFlags, liveFlags],
  );

  const sections = useMemo(
    () => partitionIntegrationSections(connections, resolveDisplay, liveFlags ?? {}),
    [connections, resolveDisplay, liveFlags],
  );
  const nextRequired = useMemo(
    () => sections.required.find(({ conn }) => connectionStatusPresentation(String(conn.status ?? ""), presentationWithFlags).label !== "Connected") ?? null,
    [sections.required, presentationWithFlags],
  );

  const dismissSetupDialog = useCallback(() => {
    setSetupTarget(null);
    if (searchParams.get("focus")) {
      router.replace(buildPathWithoutFocus(pathname, searchParams), { scroll: false });
    }
  }, [pathname, router, searchParams]);

  // After OAuth: never reopen the modal; send people back where they started (usually Home).
  useEffect(() => {
    if (!justConnected) return;
    setSetupTarget(null);
    const returnTo = searchParams.get("returnTo");
    if (returnTo) {
      const safe = resolveOAuthReturnPath(returnTo, "");
      if (safe) {
        const dest = `${safe}${safe.includes("?") ? "&" : "?"}connected=1`;
        router.replace(dest);
        return;
      }
    }
    if (searchParams.get("focus")) {
      const next = new URLSearchParams(searchParams.toString());
      next.delete("focus");
      const query = next.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    }
  }, [justConnected, pathname, router, searchParams]);

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
      justConnected,
      isConnected: (status: string) => connectionStatusPresentation(status, presentationWithFlags).label === "Connected",
    });

    if (display) {
      consumedFocusRef.current = focus;
      setSetupTarget(display);
    }
  }, [searchParams, sections.required, sections.available, setupTarget, presentationWithFlags, justConnected]);

  const emptyRequired = presentationWithFlags.emptyStates?.required ?? "Nothing required yet.";
  const emptyConnected = presentationWithFlags.emptyStates?.connected ?? "Nothing connected yet.";
  const emptyAvailable = presentationWithFlags.emptyStates?.available ?? "Nothing available yet.";

  return (
    <div style={simplePageStyle}>
      <PageHeader title="Connections" />

      {connectError === "access_denied" ? (
        <div
          style={{
            padding: spacing.md,
            borderRadius: radius.medium,
            border: "1px solid #fcd34d",
            backgroundColor: "#fffbeb",
            color: "#92400e",
            fontSize: typography.caption.fontSize,
            lineHeight: 1.55,
            display: "grid",
            gap: spacing.sm,
          }}
        >
          <div style={{ fontWeight: 750, fontSize: 15 }}>Google access denied</div>
          <div>Add a test user in Google Cloud, or connect locally.</div>
          <div style={{ display: "flex", gap: spacing.sm, flexWrap: "wrap", alignItems: "center" }}>
            <PrimaryButton onClick={() => void connectEmailLocally()} disabled={localConnecting}>
              {localConnecting ? "…" : "Connect email here"}
            </PrimaryButton>
          </div>
        </div>
      ) : null}
      {connectErrorMessage ? (
        <div
          style={{
            padding: spacing.md,
            borderRadius: radius.medium,
            border: `1px solid #fecaca`,
            backgroundColor: "#fef2f2",
            color: "#991b1b",
            fontSize: typography.caption.fontSize,
            lineHeight: 1.5,
          }}
        >
          {connectErrorMessage}
        </div>
      ) : null}
      {justConnected ? (
        <div
          style={{
            padding: spacing.md,
            borderRadius: radius.medium,
            border: `1px solid #bbf7d0`,
            backgroundColor: "#f0fdf4",
            color: "#166534",
            fontSize: typography.caption.fontSize,
            lineHeight: 1.5,
          }}
        >
          Connected. Prove it works next.
        </div>
      ) : null}
      {proveMessage ? (
        <div
          style={{
            padding: spacing.md,
            borderRadius: radius.medium,
            border: `1px solid rgba(15,118,110,.25)`,
            backgroundColor: "#f0fdfa",
            color: "#0f766e",
            fontSize: typography.caption.fontSize,
            lineHeight: 1.5,
          }}
        >
          {proveMessage}
        </div>
      ) : null}

      {nextRequired ? (
        <NextBanner
          label={nextRequired.display.title}
          onClick={() => setSetupTarget(nextRequired.display)}
          actionLabel="Connect →"
        />
      ) : null}

      <SimplePanel title="Required">
        {sections.required.length === 0 ? (
          <SimpleEmpty>{emptyRequired}</SimpleEmpty>
        ) : (
          <div>
            {sections.required.map(({ conn, display }) => (
              <IntegrationRow
                key={display.id}
                conn={conn}
                display={display}
                presentation={presentationWithFlags}
                businessId={businessId}
                onAction={setSetupTarget}
                onProve={runProve}
                proving={provingId === display.id || provingId != null && provingId.includes(display.id)}
              />
            ))}
          </div>
        )}
      </SimplePanel>

      <SimplePanel title="Connected">
        {sections.connected.length === 0 ? (
          <SimpleEmpty>{emptyConnected}</SimpleEmpty>
        ) : (
          <div>
            {sections.connected.map(({ conn, display }) => (
              <IntegrationRow
                key={`connected_${display.id}`}
                conn={conn}
                display={display}
                presentation={presentationWithFlags}
                businessId={businessId}
                onAction={setSetupTarget}
                onProve={runProve}
                proving={Boolean(provingId)}
              />
            ))}
          </div>
        )}
      </SimplePanel>

      <SimplePanel title="Available">
        {sections.available.length === 0 ? (
          <SimpleEmpty>{emptyAvailable}</SimpleEmpty>
        ) : (
          <div>
            {sections.available.map(({ conn, display }) => (
              <IntegrationRow
                key={`available_${display.id}`}
                conn={conn}
                display={display}
                presentation={presentationWithFlags}
                businessId={businessId}
                onAction={setSetupTarget}
                onProve={runProve}
                proving={Boolean(provingId)}
              />
            ))}
          </div>
        )}
      </SimplePanel>

      {setupTarget ? (
        <IntegrationSetupDialog
          integration={setupTarget}
          hasRealConnect={(() => {
            const match = [...sections.required, ...sections.available].find(({ display }) => display.id === setupTarget.id);
            return match ? hasRealConnectAction(match.conn, match.display) : false;
          })()}
          returnTo={searchParams.get("returnTo")}
          onClose={dismissSetupDialog}
        />
      ) : null}
    </div>
  );
}
