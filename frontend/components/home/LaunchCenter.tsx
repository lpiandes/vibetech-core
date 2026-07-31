"use client";

import { useState, useTransition, type CSSProperties } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  Lock,
  Loader2,
  Pause,
  Play,
  Sparkles,
} from "lucide-react";

import { cockpitColors, spacing, typography } from "@/design/tokens";
import IntegrationSetupDialog from "@/components/connections/IntegrationSetupDialog";
import { getIntegrationDisplay, type IntegrationDisplay } from "@/components/connections/integrationDisplay";
import { useWorkspaceNavigation } from "@/components/workspace/WorkspaceNavigationContext";
import SimpleModal from "@/components/product/SimpleModal";
import PrimaryButton from "@/components/product/PrimaryButton";
import SecondaryButton from "@/components/product/SecondaryButton";
export type LaunchMission = {
  id: string;
  title: string;
  detail: string;
  href: string;
  actionLabel: string;
  complete: boolean;
  blocked?: boolean;
  blockedReason?: string | null;
  blockedByMission?: number;
  proveAction?: string | null;
  status?: string | null;
  phase?: string | null;
  canProveInline?: boolean;
  needsBrandSetup?: boolean;
  requiredIntegrations?: string[];
  missionIndex?: number;
  canDefer?: boolean;
  deferred?: boolean;
  pendingOps?: boolean;
};

type ProveDialog = {
  mission: LaunchMission;
  kind: "email" | "sms" | "calendar" | "voice";
  step: "input" | "confirm";
  value: string;
  sentTo: string;
  error: string | null;
};

const INLINE_SETUP_IDS = new Set([
  "business_email",
  "calendar",
  "sms_channel",
  "voice_channel",
  "social_screening",
  "meta_lead_ads",
]);

/** Short owner-facing titles — keep substance in detail. */
const SIMPLE_TITLE: Record<string, string> = {
  customer_email_send: "Connect business email",
  calendar_scheduling: "Connect calendar",
  sms_send: "Set up text messaging",
  voice_calls: "Connect phone calling",
  social_screen_prove: "Prove social background screening",
  meta_lead_intake: "Request Facebook lead setup",
  website_forms: "Website form intake",
  knowledge_consult: "Add business knowledge",
  outbound_approvals: "Prove approval gate",
  sports_registration_golden_path: "Run a test registration",
  dental_intake_golden_path: "Run a test patient intake",
};

const SIMPLE_DETAIL: Record<string, string> = {
  customer_email_send: "Sign in with Google so VIBETech can send approved customer emails.",
  calendar_scheduling: "Connect Google Calendar so scheduling can book real appointments.",
  sms_send: "Enter your legal business name and address once — VIBETech buys a texting number and handles carrier registration. No Twilio Console required.",
  voice_calls: "Connect Twilio Voice for the Knowledge-backed AI receptionist. Prove places a test call. Customer outbound calls stay approval-gated.",
  social_screen_prove: "Connect Serper + ScrapingBee, then run a sample public-web screen. Filtered report lands in Needs Attention.",
  meta_lead_intake: "Tell us your Facebook Page — VIBETech connects Lead Ads for you. New leads land in People and fire intake automations (sends still need your approval).",
  website_forms: "Open your hosted intake form, share the link, and prove with a test submission. Leads land in People.",
  knowledge_consult: "Upload playbooks and FAQs so AI teammates answer with your voice.",
  outbound_approvals: "Confirm nothing reaches a customer without your approval.",
  sports_registration_golden_path: "Walk a registration end-to-end to prove the operating loop.",
  dental_intake_golden_path: "Walk a patient intake end-to-end to prove the operating loop.",
};

const CONNECTED_DETAIL: Record<string, string> = {
  sms_send: "Number is set up. Send a test text, then confirm you got it. US delivery may wait until carrier approval finishes.",
  customer_email_send: "Email is connected. Send a test email, then confirm you got it.",
  calendar_scheduling: "Calendar is connected. Create a test event, then confirm you see it in Google Calendar.",
};

function isDeferredMission(mission: LaunchMission) {
  return Boolean(mission.deferred) || String(mission.status ?? "") === "deferred";
}

function isPendingOpsMission(mission: LaunchMission) {
  return Boolean(mission.pendingOps) || String(mission.status ?? "") === "pending_ops";
}

function isHardBlockedMission(mission: LaunchMission) {
  return Boolean(mission.blocked) && !isDeferredMission(mission);
}

function titleFor(mission: LaunchMission) {
  return SIMPLE_TITLE[mission.id] ?? mission.title.replace(/\s*\(.*?\)\s*/g, "").trim();
}

function detailFor(mission: LaunchMission) {
  if (isPendingOpsMission(mission)) {
    return mission.detail
      || "Setup requested — VIBETech is connecting your Facebook Lead Ads. Use Request again if you need to ping us.";
  }
  if (isDeferredMission(mission)) {
    if (mission.id === "knowledge_consult") {
      return "Paused — add playbooks or FAQs whenever you’re ready. AI teammates work better with your voice.";
    }
    return mission.blockedReason || "Paused — come back whenever you’re ready.";
  }
  if (mission.id === "sms_send" && mission.needsBrandSetup) {
    return SIMPLE_DETAIL.sms_send;
  }
  if (mission.needsBrandSetup) {
    return mission.detail
      || "Enter your legal business details so we can finish setup.";
  }
  const st = String(mission.status ?? "");
  if ((st === "connected" || st === "verified") && CONNECTED_DETAIL[mission.id]) {
    return CONNECTED_DETAIL[mission.id];
  }
  return SIMPLE_DETAIL[mission.id] ?? mission.detail ?? "";
}

function phaseLabel(mission: LaunchMission) {
  const phase = String(mission.phase ?? "");
  const status = String(mission.status ?? "");
  if (mission.complete) return "Done";
  if (isPendingOpsMission(mission)) return "Pending";
  if (isDeferredMission(mission)) return "Paused";
  if (mission.blocked) return "Locked";
  if (mission.needsBrandSetup) return "Connect";
  if (String(mission.id).includes("golden_path")) {
    if (status === "connected" || status === "verified" || status === "available") return "Ready";
    return "Connect";
  }
  if (status === "connected" || status === "verified") return "Connected";
  if (status === "failed" || status === "degraded") return "Needs fix";
  if (phase === "connect") return "Connect";
  if (phase === "prove_connections" || phase === "prove_operations") return "Prove";
  if (phase === "later") return "Later";
  if (status === "needs_setup" || status === "available") return "Connect";
  return "Prove";
}

function actionLabel(mission: LaunchMission, proveReady: boolean) {
  if (mission.complete) return "Done";
  if (isPendingOpsMission(mission)) return "Request again";
  if (isDeferredMission(mission)) {
    if (mission.id === "knowledge_consult") return "Add knowledge";
    return "Resume";
  }
  if (isHardBlockedMission(mission)) return "Locked";
  if (mission.needsBrandSetup || (mission.id === "sms_send" && !proveReady)) {
    return "Set up";
  }
  if (proveReady) {
    if (mission.id === "customer_email_send") return "Send test email";
    if (mission.id === "sms_send") return "Send test text";
    return "Run test";
  }
  if (/prove|test/i.test(String(mission.actionLabel ?? ""))) return "Run test";
  if (/connect|add|upload|set up|pending/i.test(String(mission.actionLabel ?? ""))) return mission.actionLabel;
  return mission.actionLabel || "Open";
}

/**
 * Launch Center — one clear next step, full mission path, editorial density.
 */
export default function LaunchCenter({
  businessName,
  businessId,
  missions,
  verticalLabel,
  liveFlags = {},
}: {
  businessName?: string;
  businessId?: string;
  missions: LaunchMission[];
  verticalLabel?: string;
  liveFlags?: Record<string, boolean | undefined>;
}) {
  // Deferred ("I'll do this later") stays in the main list; only unsupported stays under Show later.
  const [missionOverrides, setMissionOverrides] = useState<Record<string, Partial<LaunchMission>>>({});
  const [showLater, setShowLater] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [messageById, setMessageById] = useState<Record<string, string>>({});
  const [isPending, startTransition] = useTransition();
  const [setupTarget, setSetupTarget] = useState<IntegrationDisplay | null>(null);
  const [proveDialog, setProveDialog] = useState<ProveDialog | null>(null);
  const { cancelNavigation } = useWorkspaceNavigation();

  const effectiveMissions = missions.map((m) => {
    const override = missionOverrides[m.id];
    return override ? { ...m, ...override } : m;
  });
  const visible = effectiveMissions.filter((m) => !isHardBlockedMission(m));
  const later = effectiveMissions.filter((m) => isHardBlockedMission(m));
  const complete = visible.filter((m) => m.complete).length;
  const total = visible.length || effectiveMissions.length;
  const progress = total > 0 ? Math.round((complete / total) * 100) : 0;
  // Skip pending-ops missions for the hero "next" CTA — they wait on VIBETech, not the owner.
  const next = visible.find((m) => !m.complete && !isDeferredMission(m) && !isPendingOpsMission(m)) ?? null;

  const homeReturnTo = businessId ? `/b/${businessId}/home` : "/";

  function resolveInlineSetup(mission: LaunchMission): IntegrationDisplay | null {
    const integrationId = String(mission.requiredIntegrations?.[0] ?? "");
    if (!integrationId || !INLINE_SETUP_IDS.has(integrationId)) return null;
    const display = getIntegrationDisplay(integrationId, undefined, liveFlags as any);
    if (!display || display.setupMode === "manual") return null;
    return display;
  }

  function openInlineSetup(mission: LaunchMission): boolean {
    const display = resolveInlineSetup(mission);
    if (!display) return false;
    cancelNavigation();
    setSetupTarget(display);
    return true;
  }

  function markMetaSetupPending() {
    setMissionOverrides((prev) => ({
      ...prev,
      meta_lead_intake: {
        status: "pending_ops",
        pendingOps: true,
        actionLabel: "Pending",
        detail: "Setup requested — VIBETech is connecting your Facebook Lead Ads (usually less than 24 hours). We’ll email you when it’s ready.",
        canProveInline: false,
      },
    }));
  }

  function canProve(mission: LaunchMission) {
    if (mission.needsBrandSetup) return false;
    if (mission.id === "knowledge_consult" && mission.status === "needs_setup") return false;
    if (mission.canProveInline != null) return Boolean(mission.canProveInline);
    if (!businessId || !mission.proveAction || mission.complete || mission.blocked) return false;
    const st = String(mission.status ?? "");
    if (st === "connected" || st === "verified") return true;
    if (st === "available" && !(mission.requiredIntegrations?.length)) return true;
    return false;
  }

  function openProveDialog(mission: LaunchMission) {
    if (!businessId || !mission.proveAction) return;
    if (mission.proveAction === "send_test_email") {
      setProveDialog({
        mission,
        kind: "email",
        step: "input",
        value: "",
        sentTo: "",
        error: null,
      });
      return;
    }
    if (mission.proveAction === "send_test_sms") {
      setProveDialog({
        mission,
        kind: "sms",
        step: "input",
        value: "",
        sentTo: "",
        error: null,
      });
      return;
    }
    if (mission.proveAction === "create_test_event") {
      setProveDialog({
        mission,
        kind: "calendar",
        step: "input",
        value: "",
        sentTo: "",
        error: null,
      });
      return;
    }
    if (mission.proveAction === "place_test_call") {
      setProveDialog({
        mission,
        kind: "voice",
        step: "input",
        value: "",
        sentTo: "",
        error: null,
      });
      return;
    }
    runProve(mission);
  }

  function runProve(
    mission: LaunchMission,
    opts?: { proveEmail?: string; provePhone?: string; ownerConfirmedReceipt?: boolean },
  ) {
    if (!businessId || !mission.proveAction) return;

    setPendingId(mission.id);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/businesses/${encodeURIComponent(businessId)}/integrations/prove`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: mission.proveAction,
            capabilityId: mission.id,
            outboundApproved: true,
            ...(opts?.provePhone ? { provePhone: opts.provePhone } : {}),
            ...(opts?.proveEmail ? { proveEmail: opts.proveEmail } : {}),
            ...(opts?.ownerConfirmedReceipt ? { ownerConfirmedReceipt: true } : {}),
          }),
        });
        const body = await res.json().catch(() => ({}));
        const status = String(body?.result?.status ?? "");
        const awaitingConfirm = status === "awaiting_confirm"
          || body?.result?.detail?.awaitingOwnerConfirm === true;
        const ok = Boolean(body?.result?.ok);
        const failMessage = String(
          body?.result?.message
          ?? body?.result?.detail?.message
          ?? body?.result?.detail?.delivery?.message
          ?? body?.result?.detail?.error
          ?? body?.error
          ?? "Test didn’t pass. Try again.",
        );

        if (awaitingConfirm && !opts?.ownerConfirmedReceipt) {
          const sentTo = opts?.proveEmail || opts?.provePhone || "";
          const kind: ProveDialog["kind"] =
            mission.proveAction === "send_test_sms"
              ? "sms"
              : mission.proveAction === "create_test_event"
                ? "calendar"
                : mission.proveAction === "place_test_call"
                  ? "voice"
                  : "email";
          setProveDialog((prev) => prev && prev.mission.id === mission.id
            ? {
                ...prev,
                kind,
                step: "confirm",
                sentTo,
                error: null,
              }
            : {
                mission,
                kind,
                step: "confirm",
                value: sentTo,
                sentTo,
                error: null,
              });
          setMessageById((prev) => ({
            ...prev,
            [mission.id]: kind === "calendar"
              ? "Test event created. Confirm once you see it on your calendar."
              : sentTo
                ? `Sent to ${sentTo}. Confirm once you see it.`
                : "Sent. Confirm once you see it.",
          }));
          return;
        }

        if (ok) {
          setProveDialog(null);
          setMessageById((prev) => ({
            ...prev,
            [mission.id]: String(body?.result?.message ?? "Proven — this capability works."),
          }));
          window.location.assign(`/b/${encodeURIComponent(businessId)}/home?proven=${encodeURIComponent(mission.id)}`);
          return;
        }
        setProveDialog((prev) => prev && prev.mission.id === mission.id
          ? { ...prev, error: failMessage }
          : prev);
        setMessageById((prev) => ({
          ...prev,
          [mission.id]: failMessage,
        }));
      } catch {
        const failMessage = "Test didn’t pass. Try again.";
        setProveDialog((prev) => prev && prev.mission.id === mission.id
          ? { ...prev, error: failMessage }
          : prev);
        setMessageById((prev) => ({
          ...prev,
          [mission.id]: failMessage,
        }));
      } finally {
        setPendingId(null);
      }
    });
  }

  function submitProveInput() {
    if (!proveDialog) return;
    if (proveDialog.kind === "calendar") {
      runProve(proveDialog.mission);
      return;
    }
    const value = proveDialog.value.trim();
    if (proveDialog.kind === "email") {
      if (!value || !value.includes("@")) {
        setProveDialog({ ...proveDialog, error: "Enter a valid email address." });
        return;
      }
      runProve(proveDialog.mission, { proveEmail: value });
      return;
    }
    if (!value) {
      setProveDialog({ ...proveDialog, error: "Enter a phone number with country code (e.g. +1…)." });
      return;
    }
    runProve(proveDialog.mission, { provePhone: value });
  }

  function confirmProveReceipt() {
    if (!proveDialog) return;
    runProve(proveDialog.mission, { ownerConfirmedReceipt: true });
  }

  function deferMission(mission: LaunchMission) {
    if (!businessId || mission.id !== "knowledge_consult") return;
    setPendingId(mission.id);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/businesses/${encodeURIComponent(businessId)}/integrations/prove`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: mission.proveAction || "upload_and_cite",
            capabilityId: mission.id,
            defer: true,
          }),
        });
        const body = await res.json().catch(() => ({}));
        if (body?.result?.deferred || body?.result?.status === "deferred") {
          window.location.assign(`/b/${encodeURIComponent(businessId)}/home`);
          return;
        }
        setMessageById((prev) => ({
          ...prev,
          [mission.id]: String(body?.error ?? body?.result?.message ?? "Could not skip. Try again."),
        }));
      } catch {
        setMessageById((prev) => ({
          ...prev,
          [mission.id]: "Could not skip. Try again.",
        }));
      } finally {
        setPendingId(null);
      }
    });
  }

  function needsEmailReconnect(mission: LaunchMission) {
    const msg = String(messageById[mission.id] ?? "");
    return mission.id === "customer_email_send"
      && /insufficient|send permission|Reconnect business email/i.test(msg);
  }

  const list = showLater ? [...visible, ...later] : visible;
  const ring = progressRing(progress);
  const name = businessName?.trim() || "Your business";

  return (
    <section style={{ display: "grid", gap: 22, maxWidth: 820 }} aria-label="Launch center">
      <style>{launchMotionCss}</style>

      <div className="vt-launch-hero" style={heroStyle}>
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(ellipse 80% 70% at 12% 20%, rgba(45,212,191,.28), transparent 55%),"
              + "radial-gradient(ellipse 60% 50% at 88% 10%, rgba(255,255,255,.14), transparent 50%),"
              + "radial-gradient(ellipse 50% 60% at 70% 90%, rgba(8,47,73,.35), transparent 55%)",
            pointerEvents: "none",
          }}
        />
        <div className="vt-launch-hero-grid" style={{ position: "relative", display: "grid", gridTemplateColumns: "auto 1fr", gap: 22, alignItems: "center" }}>
          <div style={{ position: "relative", width: 108, height: 108, flexShrink: 0 }} aria-hidden>
            <svg width="108" height="108" viewBox="0 0 108 108">
              <circle cx="54" cy="54" r="46" fill="none" stroke="rgba(255,255,255,.16)" strokeWidth="8" />
              <circle
                cx="54"
                cy="54"
                r="46"
                fill="none"
                stroke="#5eead4"
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={ring.dash}
                strokeDashoffset={ring.offset}
                transform="rotate(-90 54 54)"
                style={{ transition: "stroke-dashoffset 600ms ease" }}
              />
            </svg>
            <div style={{
              position: "absolute",
              inset: 0,
              display: "grid",
              placeItems: "center",
              textAlign: "center",
              lineHeight: 1.05,
            }}>
              <div>
                <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.04em" }}>{complete}/{total}</div>
                <div style={{ marginTop: 2, fontSize: 10, fontWeight: 750, letterSpacing: "0.08em", textTransform: "uppercase", opacity: 0.78 }}>
                  ready
                </div>
              </div>
            </div>
          </div>

          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                opacity: 0.78,
              }}>
                <Sparkles size={13} />
                Launch path
              </span>
              {verticalLabel ? (
                <span style={{
                  padding: "3px 9px",
                  borderRadius: 999,
                  fontSize: 11,
                  fontWeight: 700,
                  background: "rgba(255,255,255,.14)",
                  border: "1px solid rgba(255,255,255,.18)",
                }}>
                  {verticalLabel}
                </span>
              ) : null}
            </div>
            <h2 style={{
              margin: "8px 0 0",
              fontSize: "clamp(1.35rem, 2.4vw, 1.7rem)",
              fontWeight: 800,
              letterSpacing: "-0.03em",
              lineHeight: 1.15,
            }}>
              {complete === 0
                ? `Get ${name} ready to operate`
                : complete >= total
                  ? `${name} is ready`
                  : `Keep proving ${name}`}
            </h2>
            <p style={{
              margin: "8px 0 0",
              maxWidth: 520,
              fontSize: 14.5,
              lineHeight: 1.5,
              color: "rgba(255,255,255,.84)",
            }}>
              {next
                ? `Next up: ${titleFor(next)}. Connected isn’t proven until you run a real test.`
                : "Every core capability has a live proof. You’re ready to supervise."}
            </p>

            {next ? (
              canProve(next) ? (
                <button
                  type="button"
                  className="vt-launch-cta"
                  onClick={() => openProveDialog(next)}
                  disabled={isPending}
                  style={ctaButtonStyle}
                >
                  {pendingId === next.id ? <Loader2 size={18} className="animate-spin" /> : <Play size={18} fill="currentColor" />}
                  {actionLabel(next, true)}
                </button>
              ) : resolveInlineSetup(next) ? (
                <button
                  type="button"
                  className="vt-launch-cta"
                  onClick={() => openInlineSetup(next)}
                  style={ctaButtonStyle}
                >
                  {actionLabel(next, false)}
                  <ArrowRight size={18} />
                </button>
              ) : (
                <div style={{ marginTop: 16, display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
                  <Link href={next.href} className="vt-launch-cta" style={{ ...ctaLinkStyle, marginTop: 0 }}>
                    {titleFor(next)}
                    <ArrowRight size={18} />
                  </Link>
                  {next.canDefer || next.id === "knowledge_consult" ? (
                    <button
                      type="button"
                      onClick={() => deferMission(next)}
                      disabled={isPending}
                      style={{
                        border: "1px solid rgba(255,255,255,.35)",
                        background: "transparent",
                        color: "rgba(255,255,255,.92)",
                        fontWeight: 750,
                        fontSize: 14,
                        padding: "12px 14px",
                        borderRadius: 14,
                        cursor: "pointer",
                      }}
                    >
                      {pendingId === next.id ? "Saving…" : "I’ll do this later"}
                    </button>
                  ) : null}
                </div>
              )
            ) : null}
          </div>
        </div>

        <div
          aria-label={`${complete} of ${total} missions complete`}
          style={{
            position: "relative",
            marginTop: 22,
            display: "flex",
            gap: 6,
            flexWrap: "wrap",
          }}
        >
          {visible.map((mission, index) => {
            const done = mission.complete;
            const deferred = isDeferredMission(mission);
            const current = next?.id === mission.id;
            return (
              <span
                key={mission.id}
                title={`Mission ${index + 1}: ${titleFor(mission)}`}
                style={{
                  height: 8,
                  width: current ? 28 : 14,
                  borderRadius: 999,
                  background: done
                    ? "#5eead4"
                    : deferred
                      ? "#fbbf24"
                      : current
                        ? "#fff"
                        : "rgba(255,255,255,.28)",
                  boxShadow: current ? "0 0 0 3px rgba(255,255,255,.22)" : undefined,
                  transition: "width 280ms ease, background 280ms ease",
                }}
              />
            );
          })}
        </div>
      </div>

      <div style={{ display: "grid", gap: 10 }}>
        <div style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 12,
          padding: "0 2px",
        }}>
          <div style={{ fontWeight: 800, fontSize: 15, color: cockpitColors.textPrimary }}>
            Your missions
          </div>
          <div style={{ fontSize: 13, fontWeight: 650, color: cockpitColors.textMuted }}>
            {progress}% complete
          </div>
        </div>

        {list.map((mission, index) => {
          const proveReady = canProve(mission);
          const done = mission.complete;
          const deferred = isDeferredMission(mission);
          const pendingOps = isPendingOpsMission(mission);
          const locked = isHardBlockedMission(mission);
          const current = next?.id === mission.id;
          const label = titleFor(mission);
          const detail = detailFor(mission);
          const btn = actionLabel(mission, proveReady);
          const phase = phaseLabel(mission);
          const step = mission.missionIndex ?? index + 1;

          return (
            <article
              key={mission.id}
              className={current ? "vt-launch-row vt-launch-row-current" : "vt-launch-row"}
              style={{
                display: "grid",
                gridTemplateColumns: "auto 1fr auto",
                gap: 14,
                alignItems: "center",
                padding: "16px 18px",
                borderRadius: 18,
                background: done
                  ? "linear-gradient(135deg, rgba(16,185,129,.08), #fff 42%)"
                  : pendingOps
                    ? "linear-gradient(135deg, rgba(59,130,246,.08), #fff 48%)"
                  : deferred
                    ? "linear-gradient(135deg, rgba(245,158,11,.10), #fff 48%)"
                    : "#fff",
                border: `1px solid ${done
                  ? "rgba(16,185,129,.28)"
                  : pendingOps
                    ? "rgba(59,130,246,.28)"
                  : deferred
                    ? "rgba(245,158,11,.35)"
                    : current
                      ? "rgba(15,118,110,.32)"
                      : "rgba(15,23,42,.08)"}`,
                boxShadow: current
                  ? "0 10px 28px rgba(15,118,110,.10)"
                  : "0 1px 2px rgba(15,23,42,.03)",
                opacity: locked ? 0.62 : 1,
                position: "relative",
              }}
            >
              {current ? (
                <span
                  aria-hidden
                  style={{
                    position: "absolute",
                    left: 0,
                    top: 10,
                    bottom: 10,
                    width: 4,
                    borderRadius: "0 4px 4px 0",
                    background: "linear-gradient(180deg, #0f766e, #14b8a6)",
                  }}
                />
              ) : null}

              <span
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 14,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: done
                    ? "#10b981"
                    : deferred
                      ? "#f59e0b"
                      : locked
                        ? "#e7e5e4"
                        : current
                          ? "rgba(15,118,110,.12)"
                          : cockpitColors.inset,
                  color: done || deferred ? "#fff" : locked ? "#78716c" : cockpitColors.accent,
                  flexShrink: 0,
                  fontWeight: 800,
                  fontSize: 13,
                  lineHeight: 0,
                }}
                aria-label={done ? "Complete" : deferred ? "Paused" : locked ? "Locked" : `Mission ${step}`}
              >
                {done ? (
                  <Check size={18} strokeWidth={2.75} color="#fff" absoluteStrokeWidth />
                ) : deferred ? (
                  <Pause size={16} strokeWidth={0} fill="#fff" color="#fff" />
                ) : locked ? (
                  <Lock size={16} strokeWidth={2.2} color="#78716c" />
                ) : (
                  step
                )}
              </span>

              <div style={{ minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{
                    fontSize: 11,
                    fontWeight: 800,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: done
                      ? "#059669"
                      : deferred
                        ? "#b45309"
                        : current
                          ? cockpitColors.accent
                          : cockpitColors.textMuted,
                  }}>
                    Mission {step}
                    {" · "}
                    {phase}
                  </span>
                  {current ? (
                    <span style={{
                      padding: "2px 8px",
                      borderRadius: 999,
                      fontSize: 11,
                      fontWeight: 750,
                      color: "#0f766e",
                      background: "rgba(15,118,110,.1)",
                    }}>
                      Up next
                    </span>
                  ) : null}
                  {deferred ? (
                    <span style={{
                      padding: "2px 8px",
                      borderRadius: 999,
                      fontSize: 11,
                      fontWeight: 750,
                      color: "#b45309",
                      background: "rgba(245,158,11,.14)",
                    }}>
                      Paused
                    </span>
                  ) : null}
                  {pendingOps ? (
                    <span style={{
                      padding: "2px 8px",
                      borderRadius: 999,
                      fontSize: 11,
                      fontWeight: 750,
                      color: "#1d4ed8",
                      background: "rgba(59,130,246,.12)",
                    }}>
                      Pending
                    </span>
                  ) : null}
                </div>
                <div style={{
                  marginTop: 3,
                  fontWeight: 750,
                  fontSize: 16,
                  color: cockpitColors.textPrimary,
                  letterSpacing: "-0.01em",
                }}>
                  {label}
                </div>
                {detail ? (
                  <div style={{
                    marginTop: 3,
                    fontSize: 13.5,
                    lineHeight: 1.45,
                    color: cockpitColors.textSecondary,
                  }}>
                    {detail}
                  </div>
                ) : null}
                {locked && (mission.blockedReason || mission.blockedByMission) ? (
                  <div style={{ marginTop: 4, fontSize: 12, fontWeight: 650, color: cockpitColors.warning }}>
                    {mission.blockedReason
                      ?? `Finish mission ${mission.blockedByMission} first`}
                  </div>
                ) : null}
                {messageById[mission.id] ? (
                  <div style={{
                    marginTop: 6,
                    fontSize: 13,
                    fontWeight: 650,
                    color: done ? "#059669" : "#b45309",
                  }}>
                    {messageById[mission.id]}
                  </div>
                ) : null}
              </div>

              {done || locked ? (
                <span style={{
                  flexShrink: 0,
                  fontSize: 13,
                  fontWeight: 750,
                  color: done ? "#047857" : cockpitColors.textMuted,
                  padding: "8px 10px",
                }}>
                  {btn}
                </span>
              ) : pendingOps && resolveInlineSetup(mission) ? (
                <button
                  type="button"
                  onClick={() => openInlineSetup(mission)}
                  style={rowActionButtonStyle}
                  title="Still pending — tap to send another setup request to VIBETech"
                >
                  {btn}
                  <ArrowRight size={14} />
                </button>
              ) : pendingOps ? (
                <span style={{
                  flexShrink: 0,
                  fontSize: 13,
                  fontWeight: 750,
                  color: "#1d4ed8",
                  padding: "8px 10px",
                }}>
                  Pending
                </span>
              ) : needsEmailReconnect(mission) ? (
                <button
                  type="button"
                  onClick={() => openInlineSetup(mission)}
                  style={rowActionButtonStyle}
                >
                  Reconnect
                  <ArrowRight size={14} />
                </button>
              ) : proveReady ? (
                <button
                  type="button"
                  onClick={() => openProveDialog(mission)}
                  disabled={isPending && pendingId === mission.id}
                  style={rowActionButtonStyle}
                >
                  {pendingId === mission.id ? <Loader2 size={15} className="animate-spin" /> : null}
                  {btn}
                </button>
              ) : resolveInlineSetup(mission) ? (
                <button
                  type="button"
                  onClick={() => openInlineSetup(mission)}
                  style={rowActionButtonStyle}
                >
                  {btn}
                  <ArrowRight size={14} />
                </button>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" }}>
                  <Link href={mission.href} style={deferred ? rowActionAmberStyle : rowActionLinkStyle}>
                    {btn}
                    <ArrowRight size={14} />
                  </Link>
                  {!deferred && (mission.canDefer || mission.id === "knowledge_consult") ? (
                    <button
                      type="button"
                      onClick={() => deferMission(mission)}
                      disabled={isPending && pendingId === mission.id}
                      style={{
                        border: "none",
                        background: "transparent",
                        color: cockpitColors.textMuted,
                        fontWeight: 700,
                        fontSize: 12,
                        cursor: "pointer",
                        padding: "2px 4px",
                      }}
                    >
                      I’ll do this later
                    </button>
                  ) : null}
                </div>
              )}
            </article>
          );
        })}
      </div>

      {later.length > 0 ? (
        <button
          type="button"
          onClick={() => setShowLater((v) => !v)}
          style={{
            border: "none",
            background: "transparent",
            color: cockpitColors.textMuted,
            fontWeight: 700,
            fontSize: 14,
            cursor: "pointer",
            padding: spacing.sm,
            justifySelf: "start",
          }}
        >
          {showLater ? "Hide later missions" : `Show later (${later.length})`}
        </button>
      ) : null}

      {setupTarget ? (
        <IntegrationSetupDialog
          integration={setupTarget}
          hasRealConnect
          returnTo={homeReturnTo}
          onClose={() => setSetupTarget(null)}
          onMetaSetupRequested={() => {
            markMetaSetupPending();
          }}
        />
      ) : null}

      {proveDialog ? (
        <SimpleModal
          title={proveDialog.step === "confirm"
            ? (proveDialog.kind === "sms"
              ? "Did you get the text?"
              : proveDialog.kind === "calendar"
                ? "Do you see the event?"
                : proveDialog.kind === "voice"
                  ? "Did the call go through?"
                  : "Did you get the email?")
            : (proveDialog.kind === "sms"
              ? "Send test text"
              : proveDialog.kind === "calendar"
                ? "Create test calendar event"
                : proveDialog.kind === "voice"
                  ? "Place test call"
                  : "Send test email")}
          onClose={() => !isPending && setProveDialog(null)}
          footer={
            proveDialog.step === "confirm" ? (
              <>
                <SecondaryButton onClick={() => !isPending && setProveDialog({
                  ...proveDialog,
                  step: "input",
                  error: null,
                })}>
                  {proveDialog.kind === "calendar" ? "Create again" : proveDialog.kind === "voice" ? "Call again" : "Resend"}
                </SecondaryButton>
                <PrimaryButton onClick={confirmProveReceipt} disabled={isPending}>
                  {isPending && pendingId === proveDialog.mission.id ? "Saving…" : "Got it — mark done"}
                </PrimaryButton>
              </>
            ) : (
              <>
                <SecondaryButton onClick={() => !isPending && setProveDialog(null)}>Cancel</SecondaryButton>
                <PrimaryButton onClick={submitProveInput} disabled={isPending}>
                  {isPending && pendingId === proveDialog.mission.id
                    ? (proveDialog.kind === "calendar" ? "Creating…" : proveDialog.kind === "voice" ? "Calling…" : "Sending…")
                    : (proveDialog.kind === "sms"
                      ? "Send text"
                      : proveDialog.kind === "calendar"
                        ? "Create event"
                        : proveDialog.kind === "voice"
                          ? "Place call"
                          : "Send email")}
                </PrimaryButton>
              </>
            )
          }
        >
          {proveDialog.step === "confirm" ? (
            <div style={{ display: "grid", gap: spacing.md }}>
              <p style={{ ...typography.body, color: cockpitColors.textSecondary, margin: 0 }}>
                {proveDialog.kind === "sms"
                  ? `We sent a test text to ${proveDialog.sentTo || "your phone"}. Check your messages, then confirm.`
                  : proveDialog.kind === "calendar"
                    ? "We created a short event titled “VIBETech prove test” on your connected Google Calendar (about an hour from now). Open Google Calendar, then confirm."
                    : proveDialog.kind === "voice"
                      ? `We placed a test call to ${proveDialog.sentTo || "your phone"}. Confirm when you’ve received it.`
                      : `We sent a test email to ${proveDialog.sentTo || "your inbox"}. Check your inbox (and spam), then confirm.`}
              </p>
              <p style={{ ...typography.body, color: cockpitColors.textMuted, margin: 0, fontSize: 13 }}>
                Mission stays open until you confirm — the API succeeding alone doesn’t mark it done.
              </p>
              {proveDialog.error ? (
                <p style={{ color: "#dc2626", margin: 0, fontSize: 13, fontWeight: 650 }}>{proveDialog.error}</p>
              ) : null}
            </div>
          ) : proveDialog.kind === "calendar" ? (
            <div style={{ display: "grid", gap: spacing.md }}>
              <p style={{ ...typography.body, color: cockpitColors.textSecondary, margin: 0 }}>
                We’ll create a short “VIBETech prove test” event on the Google Calendar you connected. After it appears, you’ll confirm you can see it.
              </p>
              {proveDialog.error ? (
                <p style={{ color: "#dc2626", margin: 0, fontSize: 13, fontWeight: 650 }}>{proveDialog.error}</p>
              ) : null}
            </div>
          ) : (
            <div style={{ display: "grid", gap: spacing.md }}>
              <p style={{ ...typography.body, color: cockpitColors.textSecondary, margin: 0 }}>
                {proveDialog.kind === "sms"
                  ? "Enter the phone number that should receive the prove text."
                  : proveDialog.kind === "voice"
                    ? "Enter the phone number that should receive the prove call."
                    : "Enter the email address that should receive the prove message."}
              </p>
              <label style={{ display: "flex", flexDirection: "column", gap: spacing.xs }}>
                <span style={{ fontWeight: 650, fontSize: typography.caption.fontSize }}>
                  {proveDialog.kind === "sms" || proveDialog.kind === "voice" ? "Phone number" : "Email address"}
                </span>
                <input
                  type={proveDialog.kind === "sms" || proveDialog.kind === "voice" ? "tel" : "email"}
                  autoFocus
                  value={proveDialog.value}
                  onChange={(e) => setProveDialog({ ...proveDialog, value: e.target.value, error: null })}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      submitProveInput();
                    }
                  }}
                  placeholder={proveDialog.kind === "sms" || proveDialog.kind === "voice" ? "+1…" : "you@company.com"}
                  style={{
                    padding: `${spacing.sm} ${spacing.md}`,
                    borderRadius: 10,
                    border: `1px solid ${proveDialog.error ? "#dc2626" : cockpitColors.panelBorder}`,
                    fontSize: 15,
                  }}
                />
              </label>
              {proveDialog.error ? (
                <p style={{ color: "#dc2626", margin: 0, fontSize: 13, fontWeight: 650 }}>{proveDialog.error}</p>
              ) : null}
            </div>
          )}
        </SimpleModal>
      ) : null}
    </section>
  );
}

function progressRing(percent: number) {
  const r = 46;
  const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(100, percent)) / 100;
  return { dash: `${c}`, offset: `${c * (1 - p)}` };
}

const heroStyle: CSSProperties = {
  position: "relative",
  overflow: "hidden",
  borderRadius: 24,
  padding: "26px 24px 22px",
  color: "#fff",
  background: "linear-gradient(135deg, #0b3d3a 0%, #0f766e 48%, #0d9488 100%)",
  boxShadow: "0 18px 42px rgba(15,118,110,.22)",
};

const ctaButtonStyle: CSSProperties = {
  marginTop: 16,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 10,
  padding: "13px 18px",
  borderRadius: 14,
  background: "#fff",
  color: "#0f766e",
  fontWeight: 800,
  fontSize: 15,
  border: "none",
  cursor: "pointer",
  boxShadow: "0 8px 20px rgba(8,47,73,.18)",
};

const ctaLinkStyle: CSSProperties = {
  ...ctaButtonStyle,
  textDecoration: "none",
};

const rowActionButtonStyle: CSSProperties = {
  flexShrink: 0,
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "10px 14px",
  borderRadius: 12,
  border: "none",
  background: cockpitColors.accent,
  color: "#fff",
  fontWeight: 800,
  fontSize: 13,
  cursor: "pointer",
};

const rowActionLinkStyle: CSSProperties = {
  ...rowActionButtonStyle,
  textDecoration: "none",
};

const rowActionAmberStyle: CSSProperties = {
  ...rowActionLinkStyle,
  background: "#d97706",
};

const launchMotionCss = `
  .vt-launch-hero { animation: vt-launch-in 420ms ease both; }
  .vt-launch-row { animation: vt-launch-row-in 380ms ease both; }
  .vt-launch-cta { transition: transform 160ms ease, filter 160ms ease; }
  .vt-launch-cta:hover { transform: translateY(-1px); filter: brightness(1.02); }
  .vt-launch-cta:active { transform: translateY(0); }
  .vt-launch-row-current { animation-name: vt-launch-row-in, vt-launch-pulse; animation-duration: 380ms, 2.4s; animation-timing-function: ease, ease-in-out; animation-iteration-count: 1, infinite; }
  @keyframes vt-launch-in {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: none; }
  }
  @keyframes vt-launch-row-in {
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: none; }
  }
  @keyframes vt-launch-pulse {
    0%, 100% { box-shadow: 0 10px 28px rgba(15,118,110,.10); }
    50% { box-shadow: 0 12px 32px rgba(15,118,110,.18); }
  }
  @media (prefers-reduced-motion: reduce) {
    .vt-launch-hero, .vt-launch-row, .vt-launch-row-current, .vt-launch-cta { animation: none !important; transition: none !important; }
  }
  @media (max-width: 640px) {
    .vt-launch-hero-grid { grid-template-columns: 1fr !important; justify-items: start; }
  }
`;
