"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { useConnectionsViewModel } from "./ConnectionsContext";
import IntegrationSetupDialog from "./IntegrationSetupDialog";
import { getIntegrationDisplay } from "./integrationDisplay";
import { buildPathWithoutFocus, resolveOAuthReturnPath, shouldOpenIntegrationFromFocus } from "@/lib/connections/integrationFocusRouting.js";
import PageHeader from "@/components/product/PageHeader";
import PrimaryButton from "@/components/product/PrimaryButton";
import { NextBanner, simplePageStyle } from "@/components/product/SimpleUI";
import StatusBadge from "@/components/product/StatusBadge";
import { cockpitColors, spacing, typography, radius } from "@/design/tokens";
import { useOptionalBusinessScope } from "@/lib/platform/BusinessScopeContext";
import {
  connectionStatusPresentation,
  deriveIntegrationMetrics,
  hasRealConnectAction,
  mergeIntegrationDisplay,
  partitionIntegrationSections,
  primaryIntegrationAction,
  setupBlockerSummary,
  type ConnectionViewRow,
  type IntegrationsPresentation,
} from "./integrationsSemantics";
import type { IntegrationDisplay } from "./integrationDisplay";
import { resolveNextConnectionFocus } from "../../../backend/core/platform/commercial/resolveOwnerSetupPath.js";
import {
  buildProveOwnerResultCopy,
  buildProveRequestBody,
  isProveAwaitingConfirm,
  proveNeedsDestination,
  proveNeedsOwnerConfirm,
} from "../../../backend/core/integrations/prove/proveOwnerFlow.js";
import { proveGuidanceForAction } from "../../../backend/core/integrations/prove/proveOwnerGuidance.js";
import SimpleModal from "@/components/product/SimpleModal";
import SecondaryButton from "@/components/product/SecondaryButton";
import { OwnerGuidanceBlock } from "./OwnerGuidanceBlock";
import { smsCarrierOwnerCopy } from "../../../backend/core/integrations/sms/smsCarrierStatus.js";
import {
  ConnectionCardShell,
  ConnectionJourneyRail,
  IntegrationsHero,
  SectionLabel,
  resolveJourneyPhase,
  setupJourneyKeyframes,
} from "./setupJourneyUi";

function safeArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function IntegrationRow({
  conn,
  display,
  presentation,
  businessId,
  pendingOpsRequests,
  onAction,
  onProve,
  onRequestSetup,
  onRefreshA2p,
  proving,
  refreshingA2p,
}: {
  conn: ConnectionViewRow;
  display: IntegrationDisplay;
  presentation: IntegrationsPresentation;
  businessId?: string;
  pendingOpsRequests?: Record<string, unknown>;
  onAction: (display: IntegrationDisplay) => void;
  onProve?: (action: string, capabilityId: string, connectionId: string) => void;
  onRequestSetup?: (display: IntegrationDisplay) => void;
  onRefreshA2p?: () => void;
  proving?: boolean;
  refreshingA2p?: boolean;
}) {
  const Icon = display.icon;
  const status = connectionStatusPresentation(String(conn.status ?? ""), presentation);
  const action = primaryIntegrationAction(conn, display, pendingOpsRequests ?? {});
  const blocker = setupBlockerSummary(conn, display);
  const phase = resolveJourneyPhase({ actionKind: action?.kind, status: conn.status });
  const smsConnected = display.id === "sms_channel" && String(conn.status ?? "").toUpperCase() === "CONNECTED";
  const badgeLabel =
    action?.kind === "pending_ops"
      ? "Pending"
      : action?.kind === "good_to_go"
        ? "Good to go"
        : status.label;
  const badgeTone =
    action?.kind === "pending_ops"
      ? "warning"
      : action?.kind === "good_to_go"
        ? "success"
        : status.tone;
  const cardAccent =
    action?.kind === "pending_ops"
      ? ("pending" as const)
      : action?.kind === "good_to_go" || action?.kind === "prove"
        ? ("ready" as const)
        : (String(conn.status ?? "").toUpperCase() === "PROVEN" || String(conn.status ?? "").toUpperCase() === "VERIFIED")
          ? ("live" as const)
          : ("idle" as const);

  const helper =
    action?.kind === "pending_ops"
      ? ((action as { pendingCopy?: string }).pendingCopy
        ?? "Hold on — VIBETech is setting this up for you.")
      : action?.kind === "good_to_go"
        ? ((action as { readyCopy?: string }).readyCopy
          ?? "VIBETech finished setup. Confirm Connected, then run Test it works.")
        : smsConnected
          ? smsCarrierCopy(conn)
          : blocker
            ? blocker
            : String(conn.status ?? "").toUpperCase() === "CONNECTED"
              ? "Connected is not tested yet — run Test it works with a real send."
              : String(conn.status ?? "").toUpperCase() === "PROVEN" || String(conn.status ?? "").toUpperCase() === "VERIFIED"
                ? "Tested with real evidence. You're good."
                : (display.description ?? null);

  return (
    <ConnectionCardShell accent={cardAccent} style={{ animation: "vtSetupFadeUp 280ms ease-out" }}>
      <span
        style={{
          width: 44,
          height: 44,
          borderRadius: 14,
          background: "linear-gradient(145deg, rgba(34,211,238,0.18), rgba(15,23,42,0.9))",
          border: "1px solid rgba(34,211,238,0.25)",
          color: cockpitColors.accent,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <Icon size={20} />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: spacing.sm, flexWrap: "wrap" }}>
          <div style={{ fontWeight: 750, fontSize: 15, color: cockpitColors.textPrimary }}>{display.title}</div>
          <StatusBadge label={badgeLabel} tone={badgeTone} />
        </div>
        {helper ? (
          <div style={{ fontSize: 13, color: cockpitColors.textSecondary, marginTop: 6, lineHeight: 1.45 }}>
            {helper}
          </div>
        ) : null}
        <ConnectionJourneyRail phase={phase} />
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", flexShrink: 0 }}>
        {smsConnected && onRefreshA2p ? (
          <SecondaryButton onClick={onRefreshA2p} disabled={Boolean(refreshingA2p || proving)}>
            {refreshingA2p ? "Refreshing…" : "Refresh status"}
          </SecondaryButton>
        ) : null}
        {action?.kind === "prove" && onProve && businessId ? (
          <PrimaryButton onClick={() => onProve(action.proveAction!, action.capabilityId!, display.id)} disabled={proving}>
            {proving ? "Testing…" : action.label}
          </PrimaryButton>
        ) : action?.kind === "pending_ops" ? (
          <PrimaryButton disabled>{action.label}</PrimaryButton>
        ) : action?.kind === "request_setup" && onRequestSetup ? (
          <PrimaryButton onClick={() => onRequestSetup(display)}>{action.label}</PrimaryButton>
        ) : action?.kind === "good_to_go" ? (
          <PrimaryButton onClick={() => onAction(display)}>{action.label}</PrimaryButton>
        ) : action ? (
          <PrimaryButton onClick={() => onAction(display)} disabled={(action as { disabled?: boolean }).disabled}>
            {action.label}
          </PrimaryButton>
        ) : null}
      </div>
    </ConnectionCardShell>
  );
}

/** Connected SMS is not fully live until carrier (A2P) approval. */
function smsCarrierCopy(conn: ConnectionViewRow) {
  return smsCarrierOwnerCopy(conn);
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
  const pendingOpsRequests = (vm?.pendingOpsRequests && typeof vm.pendingOpsRequests === "object"
    ? vm.pendingOpsRequests
    : {}) as Record<string, unknown>;
  const [setupTarget, setSetupTarget] = useState<IntegrationDisplay | null>(null);
  const [provingId, setProvingId] = useState<string | null>(null);
  const [proveMessage, setProveMessage] = useState<string | null>(null);
  const [proveDialog, setProveDialog] = useState<{
    action: string;
    capabilityId: string;
    connectionId: string;
    kind: "intro" | "phone" | "email" | "confirm" | "result";
    value: string;
    sentTo: string;
    error: string | null;
    resultTitle?: string;
    resultSteps?: string[];
    resultOk?: boolean;
  } | null>(null);
  const consumedFocusRef = useRef<string | null>(null);
  const consumedConnectedRef = useRef<string | null>(null);
  const connectError = searchParams.get("error");
  const connectedParam = searchParams.get("connected");
  const justConnectedType =
    connectedParam === "1" || connectedParam === "business_email" || connectedParam === "calendar" || connectedParam === "google_search_console"
      ? connectedParam === "1"
        ? "any"
        : connectedParam
      : null;
  const actuallyConnected = useMemo(() => {
    if (!justConnectedType) return false;
    return connections.some((conn) => {
      const status = String(conn.status ?? "").toUpperCase();
      if (status !== "CONNECTED" && status !== "VERIFIED" && status !== "PROVEN") return false;
      if (justConnectedType === "any") return true;
      if (justConnectedType === "business_email") return conn.id === "business_email";
      if (justConnectedType === "calendar") return conn.id === "calendar";
      return conn.id === justConnectedType;
    });
  }, [connections, justConnectedType]);
  const justConnected = Boolean(justConnectedType && actuallyConnected);
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
  const [refreshingA2p, setRefreshingA2p] = useState(false);

  async function refreshSmsA2pStatus() {
    if (!businessId) return;
    setRefreshingA2p(true);
    setProveMessage(null);
    try {
      const res = await fetch(`/api/businesses/${encodeURIComponent(businessId)}/integrations/sms/a2p`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setProveMessage(String(data.error ?? "Could not refresh carrier status."));
        return;
      }
      const status = String(data.a2pRegistrationStatus ?? "pending");
      setProveMessage(
        data.message
          ? String(data.message)
          : `Carrier status: ${status}. ${status === "approved" ? "US texts can deliver — run Test it works." : "Still pending — check again later."}`,
      );
      router.refresh();
    } catch (err) {
      setProveMessage(err instanceof Error ? err.message : "Carrier refresh failed.");
    } finally {
      setRefreshingA2p(false);
    }
  }

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

  const executeProve = useCallback(
    async (
      action: string,
      capabilityId: string,
      opts: {
        provePhone?: string;
        proveEmail?: string;
        ownerConfirmedReceipt?: boolean;
        connectionId?: string;
      } = {},
    ) => {
      if (!businessId) return;
      const connectionId = opts.connectionId
        || proveDialog?.connectionId
        || capabilityId;
      setProvingId(connectionId);
      setProveMessage(null);
      try {
        const res = await fetch(`/api/businesses/${encodeURIComponent(businessId)}/integrations/prove`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(buildProveRequestBody({
            action,
            capabilityId,
            provePhone: opts.provePhone ? String(opts.provePhone) : null,
            proveEmail: opts.proveEmail ? String(opts.proveEmail) : null,
            ownerConfirmedReceipt: opts.ownerConfirmedReceipt === true,
            outboundApproved: true,
          } as any)),
        });
        const body = await res.json().catch(() => ({}));
        const result = body?.result ?? {};
        const ok = Boolean(result?.ok);
        const responsibility = body?.responsibilityProof ?? result?.responsibilityProof ?? null;
        if (isProveAwaitingConfirm(result) && !opts.ownerConfirmedReceipt && proveNeedsOwnerConfirm(action)) {
          const guidance = proveGuidanceForAction(action);
          const sentTo = opts.provePhone || opts.proveEmail || "";
          setProveDialog({
            action,
            capabilityId,
            connectionId,
            kind: "confirm",
            value: "",
            sentTo,
            error: null,
            resultTitle: guidance.confirmTitle ?? "Did you get it?",
            resultSteps: guidance.confirmSteps?.length
              ? [...guidance.confirmSteps]
              : [`We dialed/sent to ${sentTo || "your test destination"}. Confirm you received it.`],
          });
          setProveMessage(String(result?.message ?? "Confirm you received the test."));
          return;
        }
        const copy = buildProveOwnerResultCopy({ action, result, ok });
        const followThrough = responsibility?.promoted
          ? ` Responsibility promoted to live (${responsibility.promoted}).`
          : responsibility?.resolvedConstraints?.length
            ? ` Closed ${responsibility.resolvedConstraints.length} connection constraint(s).`
            : "";
        setProveMessage(`${copy.banner}${followThrough}`);
        setProveDialog({
          action,
          capabilityId,
          connectionId,
          kind: "result",
          value: "",
          sentTo: opts.provePhone || opts.proveEmail || "",
          error: null,
          resultTitle: copy.title,
          resultSteps: copy.steps,
          resultOk: ok,
        });
        if (ok) router.refresh();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Prove failed.";
        setProveMessage(message);
        setProveDialog({
          action,
          capabilityId,
          connectionId,
          kind: "result",
          value: "",
          sentTo: "",
          error: null,
          resultTitle: "Test didn’t finish",
          resultSteps: [message, "Fix the issue, then tap Test it works again."],
          resultOk: false,
        });
      } finally {
        setProvingId(null);
      }
    },
    [businessId, proveDialog?.connectionId, router],
  );

  const runProve = useCallback(
    (action: string, capabilityId: string, connectionId?: string) => {
      const guidance = proveGuidanceForAction(action);
      setProveDialog({
        action,
        capabilityId,
        connectionId: connectionId || capabilityId,
        kind: "intro",
        value: "",
        sentTo: "",
        error: null,
        resultTitle: guidance.beforeTitle,
        resultSteps: [...guidance.beforeSteps],
      });
    },
    [],
  );

  const continueProveFromIntro = useCallback(() => {
    if (!proveDialog) return;
    const dest = proveNeedsDestination(proveDialog.action);
    if (dest === "phone" || dest === "email") {
      const guidance = proveGuidanceForAction(proveDialog.action);
      setProveDialog({
        ...proveDialog,
        kind: dest,
        value: "",
        error: null,
        resultTitle: guidance.destinationHint ?? (dest === "phone" ? "Test phone number" : "Test email"),
        resultSteps: [],
      });
      return;
    }
    void executeProve(proveDialog.action, proveDialog.capabilityId, {
      connectionId: proveDialog.connectionId,
    });
  }, [executeProve, proveDialog]);

  const dispatchConnectionAction = useCallback(
    (display: IntegrationDisplay, conn?: ConnectionViewRow | null) => {
      if (!conn) {
        setSetupTarget(display);
        return;
      }
      const action = primaryIntegrationAction(conn, display, pendingOpsRequests);
      if (action?.kind === "prove" && action.proveAction && action.capabilityId) {
        runProve(action.proveAction, action.capabilityId, display.id);
        return;
      }
      setSetupTarget(display);
    },
    [pendingOpsRequests, runProve],
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

  const packageNext = useMemo(() => {
    const statuses: Record<string, string> = {};
    for (const conn of connections) {
      statuses[String(conn.id)] = String(conn.status ?? "");
    }
    return resolveNextConnectionFocus({
      purchasedPackages: (scope?.purchasedPackages ?? []) as string[],
      connectionStatuses: statuses,
    } as any);
  }, [connections, scope?.purchasedPackages]);

  const nextBanner = useMemo(() => {
    const resolveActionLabel = (display: IntegrationDisplay, conn?: ConnectionViewRow | null) => {
      if (!conn) return "Connect →";
      const action = primaryIntegrationAction(conn, display, pendingOpsRequests);
      if (action?.kind === "pending_ops") return "Pending";
      if (action?.kind === "good_to_go") return "Good to go →";
      if (action?.kind === "request_setup") return "Request setup →";
      if (action?.kind === "prove") return "Test it →";
      return "Connect →";
    };
    if (packageNext.connectionId) {
      const fromSections = [...sections.required, ...sections.available, ...sections.connected]
        .find(({ display }) => display.id === packageNext.connectionId);
      if (fromSections) {
        return {
          display: fromSections.display,
          conn: fromSections.conn,
          label: packageNext.label || fromSections.display.title,
          actionLabel: resolveActionLabel(fromSections.display, fromSections.conn),
        };
      }
      const display = getIntegrationDisplay(packageNext.connectionId, packageNext.label ?? packageNext.connectionId, liveFlags ?? {});
      return {
        display,
        conn: null,
        label: packageNext.label || packageNext.connectionId,
        actionLabel: "Request setup →",
      };
    }
    if (nextRequired) {
      return {
        display: nextRequired.display,
        conn: nextRequired.conn,
        label: nextRequired.display.title,
        actionLabel: resolveActionLabel(nextRequired.display, nextRequired.conn),
      };
    }
    return null;
  }, [packageNext, nextRequired, sections, liveFlags, pendingOpsRequests]);

  const dismissSetupDialog = useCallback(() => {
    setSetupTarget(null);
    if (searchParams.get("focus")) {
      router.replace(buildPathWithoutFocus(pathname, searchParams), { scroll: false });
    }
  }, [pathname, router, searchParams]);

  // After OAuth: never reopen the modal. Only keep the success banner when status is real.
  useEffect(() => {
    if (!connectedParam) {
      consumedConnectedRef.current = null;
      return;
    }
    if (consumedConnectedRef.current === connectedParam) return;
    consumedConnectedRef.current = connectedParam;
    setSetupTarget(null);
    if (!actuallyConnected) {
      const next = new URLSearchParams(searchParams.toString());
      next.delete("connected");
      const query = next.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
      router.refresh();
      return;
    }
    router.refresh();
    const returnTo = searchParams.get("returnTo");
    if (returnTo) {
      const safe = resolveOAuthReturnPath(returnTo, "");
      if (safe) {
        const dest = `${safe}${safe.includes("?") ? "&" : "?"}connected=${encodeURIComponent(connectedParam)}`;
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
  }, [actuallyConnected, connectedParam, pathname, router, searchParams]);

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
  const metrics = deriveIntegrationMetrics(connections, presentationWithFlags);
  const needsYou = sections.required.filter(({ conn, display }) => {
    const action = primaryIntegrationAction(conn, display, pendingOpsRequests);
    const st = String(conn.status ?? "").toUpperCase();
    return action?.kind === "request_setup" || action?.kind === "pending_ops" || action?.kind === "good_to_go"
      || action?.kind === "prove" || st === "NOT_CONNECTED" || st === "CONFIGURING";
  }).length;


  return (
    <div style={simplePageStyle}>
      <style dangerouslySetInnerHTML={{ __html: setupJourneyKeyframes }} />
      <PageHeader title="Integrations" />
      <IntegrationsHero connectedCount={metrics.connected} needsAttentionCount={needsYou} />

      {connectError === "access_denied" ? (
        <div
          style={{
            padding: spacing.md,
            borderRadius: radius.medium,
            border: "1px solid rgba(251,191,36,0.35)",
            backgroundColor: "rgba(251,191,36,0.12)",
            color: "#fbbf24",
            fontSize: typography.caption.fontSize,
            lineHeight: 1.55,
            display: "grid",
            gap: spacing.sm,
          }}
        >
          <div style={{ fontWeight: 750, fontSize: 15 }}>Google access denied</div>
          <div style={{ color: cockpitColors.textSecondary }}>Add a test user in Google Cloud, or connect locally.</div>
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
            border: `1px solid rgba(248,113,113,0.35)`,
            backgroundColor: "rgba(248,113,113,0.12)",
            color: cockpitColors.critical,
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
            border: `1px solid rgba(52,211,153,0.35)`,
            backgroundColor: "rgba(52,211,153,0.12)",
            color: cockpitColors.handled,
            fontSize: typography.caption.fontSize,
            lineHeight: 1.5,
          }}
        >
          Connected. Use <strong>Test it works</strong> on this row when you are ready to verify a real send or calendar action.
        </div>
      ) : null}
      {proveMessage ? (
        <div
          style={{
            padding: spacing.md,
            borderRadius: radius.medium,
            border: `1px solid ${cockpitColors.panelBorder}`,
            backgroundColor: cockpitColors.panelElevated,
            color: cockpitColors.textPrimary,
            fontSize: typography.caption.fontSize,
            lineHeight: 1.5,
          }}
        >
          {proveMessage}
        </div>
      ) : null}

      {nextBanner ? (
        <NextBanner
          label={nextBanner.label}
          onClick={() => dispatchConnectionAction(nextBanner.display, nextBanner.conn)}
          actionLabel={nextBanner.actionLabel}
        />
      ) : null}

      <section style={{ display: "grid", gap: 12 }}>
        <SectionLabel hint="Start here if something still needs setup">Needs attention</SectionLabel>
        {sections.required.length === 0 ? (
          <div style={{ padding: "18px 16px", borderRadius: 16, border: `1px solid ${cockpitColors.panelBorder}`, background: cockpitColors.panel, color: cockpitColors.textSecondary, fontSize: 14, fontWeight: 600 }}>
            {emptyRequired}
          </div>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {sections.required.map(({ conn, display }) => (
              <IntegrationRow
                key={display.id}
                conn={conn}
                display={display}
                presentation={presentationWithFlags}
                businessId={businessId}
                pendingOpsRequests={pendingOpsRequests}
                onAction={setSetupTarget}
                onRequestSetup={setSetupTarget}
                onProve={runProve}
                onRefreshA2p={display.id === "sms_channel" ? () => void refreshSmsA2pStatus() : undefined}
                refreshingA2p={refreshingA2p}
                proving={provingId === display.id}
              />
            ))}
          </div>
        )}
      </section>

      <section style={{ display: "grid", gap: 12 }}>
        <SectionLabel hint="Already linked — still run Test when you see it">Connected</SectionLabel>
        {sections.connected.length === 0 ? (
          <div style={{ padding: "18px 16px", borderRadius: 16, border: `1px solid ${cockpitColors.panelBorder}`, background: cockpitColors.panel, color: cockpitColors.textSecondary, fontSize: 14, fontWeight: 600 }}>
            {emptyConnected}
          </div>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {sections.connected.map(({ conn, display }) => (
              <IntegrationRow
                key={`connected_${display.id}`}
                conn={conn}
                display={display}
                presentation={presentationWithFlags}
                businessId={businessId}
                pendingOpsRequests={pendingOpsRequests}
                onAction={setSetupTarget}
                onRequestSetup={setSetupTarget}
                onProve={runProve}
                onRefreshA2p={display.id === "sms_channel" ? () => void refreshSmsA2pStatus() : undefined}
                refreshingA2p={refreshingA2p}
                proving={provingId === display.id}
              />
            ))}
          </div>
        )}
      </section>

      <section style={{ display: "grid", gap: 12 }}>
        <SectionLabel hint="Optional channels you can add anytime">Available</SectionLabel>
        {sections.available.length === 0 ? (
          <div style={{ padding: "18px 16px", borderRadius: 16, border: `1px solid ${cockpitColors.panelBorder}`, background: cockpitColors.panel, color: cockpitColors.textSecondary, fontSize: 14, fontWeight: 600 }}>
            {emptyAvailable}
          </div>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {sections.available.map(({ conn, display }) => (
              <IntegrationRow
                key={`available_${display.id}`}
                conn={conn}
                display={display}
                presentation={presentationWithFlags}
                businessId={businessId}
                pendingOpsRequests={pendingOpsRequests}
                onAction={setSetupTarget}
                onRequestSetup={setSetupTarget}
                onProve={runProve}
                onRefreshA2p={display.id === "sms_channel" ? () => void refreshSmsA2pStatus() : undefined}
                refreshingA2p={refreshingA2p}
                proving={provingId === display.id}
              />
            ))}
          </div>
        )}
      </section>

      {proveDialog ? (
        <SimpleModal
          title={
            proveDialog.kind === "intro"
              ? (proveDialog.resultTitle ?? "Test it works")
              : proveDialog.kind === "confirm"
                ? (proveDialog.resultTitle ?? "Did you get it?")
                : proveDialog.kind === "result"
                  ? (proveDialog.resultTitle ?? "Test result")
                  : proveDialog.kind === "phone"
                    ? "Test phone number"
                    : "Test email"
          }
          onClose={() => setProveDialog(null)}
          maxWidth={460}
          footer={
            proveDialog.kind === "result" ? (
              <PrimaryButton onClick={() => setProveDialog(null)}>Got it</PrimaryButton>
            ) : proveDialog.kind === "intro" ? (
              <>
                <SecondaryButton onClick={() => setProveDialog(null)}>Cancel</SecondaryButton>
                <PrimaryButton onClick={continueProveFromIntro} disabled={Boolean(provingId)}>
                  {provingId ? "Testing…" : "Continue"}
                </PrimaryButton>
              </>
            ) : (
              <>
                <SecondaryButton onClick={() => setProveDialog(null)}>Cancel</SecondaryButton>
                <PrimaryButton
                  onClick={() => {
                    if (proveDialog.kind === "confirm") {
                      const dest = proveNeedsDestination(proveDialog.action);
                      void executeProve(proveDialog.action, proveDialog.capabilityId, {
                        provePhone: dest === "phone" ? (proveDialog.sentTo || undefined) : undefined,
                        proveEmail: dest === "email" || proveDialog.sentTo.includes("@")
                          ? (proveDialog.sentTo || undefined)
                          : undefined,
                        ownerConfirmedReceipt: true,
                        connectionId: proveDialog.connectionId,
                      });
                      return;
                    }
                    const value = proveDialog.value.trim();
                    if (!value) {
                      setProveDialog((d) => d ? { ...d, error: proveDialog.kind === "phone" ? "Enter a phone like +1…" : "Enter an email." } : d);
                      return;
                    }
                    void executeProve(proveDialog.action, proveDialog.capabilityId, {
                      provePhone: proveDialog.kind === "phone" ? value : undefined,
                      proveEmail: proveDialog.kind === "email" ? value : undefined,
                      connectionId: proveDialog.connectionId,
                    });
                  }}
                  disabled={Boolean(provingId)}
                >
                  {provingId ? "Testing…" : proveDialog.kind === "confirm" ? "Yes — I got it" : "Send test"}
                </PrimaryButton>
              </>
            )
          }
        >
          <div style={{ display: "grid", gap: 10 }}>
            {proveDialog.kind === "intro" || proveDialog.kind === "confirm" || proveDialog.kind === "result" ? (
              <OwnerGuidanceBlock
                title={null}
                steps={proveDialog.resultSteps ?? []}
                tone={
                  proveDialog.kind === "result"
                    ? (proveDialog.resultOk ? "success" : "danger")
                    : "default"
                }
              />
            ) : (
              <p style={{ margin: 0, color: cockpitColors.textSecondary, fontSize: 14, lineHeight: 1.45 }}>
                {proveGuidanceForAction(proveDialog.action).destinationHint
                  ?? (proveDialog.kind === "phone"
                    ? "Enter a real phone (E.164, e.g. +15551234567)."
                    : "Enter an email address for the test send.")}
              </p>
            )}
            {proveDialog.kind === "phone" || proveDialog.kind === "email" ? (
              <input
                value={proveDialog.value}
                onChange={(e) => setProveDialog((d) => d ? { ...d, value: e.target.value, error: null } : d)}
                placeholder={proveDialog.kind === "phone" ? "+1…" : "you@business.com"}
                style={{
                  padding: 10,
                  borderRadius: 8,
                  border: `1px solid ${cockpitColors.panelBorder}`,
                  background: cockpitColors.panelElevated,
                  color: cockpitColors.textPrimary,
                }}
              />
            ) : null}
            {proveDialog.error ? (
              <p style={{ margin: 0, color: "#b91c1c", fontSize: 13 }}>{proveDialog.error}</p>
            ) : null}
          </div>
        </SimpleModal>
      ) : null}

      {setupTarget ? (
        <IntegrationSetupDialog
          integration={setupTarget}
          hasRealConnect={(() => {
            const match = [...sections.required, ...sections.available, ...sections.connected]
              .find(({ display }) => display.id === setupTarget.id);
            return match ? hasRealConnectAction(match.conn, match.display, pendingOpsRequests) : false;
          })()}
          pendingOpsRequest={(() => {
            const match = [...sections.required, ...sections.available, ...sections.connected]
              .find(({ display }) => display.id === setupTarget.id);
            const base = pendingOpsRequests[setupTarget.id];
            const status = match?.conn?.status ?? null;
            if (!base && !status) return null;
            return {
              ...(base && typeof base === "object" ? base : {}),
              connectionStatus: status,
            };
          })()}
          returnTo={searchParams.get("returnTo")}
          onClose={dismissSetupDialog}
          onSetupRequested={() => {
            dismissSetupDialog();
            router.refresh();
          }}
        />
      ) : null}
    </div>
  );
}
