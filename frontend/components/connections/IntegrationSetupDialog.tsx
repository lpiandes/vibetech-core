"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import SimpleModal from "@/components/product/SimpleModal";
import PrimaryButton from "@/components/product/PrimaryButton";
import SecondaryButton from "@/components/product/SecondaryButton";
import type { IntegrationDisplay } from "./integrationDisplay";
import { cockpitColors, spacing, typography } from "@/design/tokens";
import { useBusinessScope } from "@/lib/platform/BusinessScopeContext";

export default function IntegrationSetupDialog({
  integration,
  hasRealConnect = false,
  onClose,
}: {
  integration: IntegrationDisplay;
  hasRealConnect?: boolean;
  onClose: () => void;
}) {
  const Icon = integration.icon;
  const router = useRouter();
  const { businessId } = useBusinessScope();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [apiKeyForm, setApiKeyForm] = useState({ accountSid: "", authToken: "", fromNumber: "", twimlUrl: "" });
  const [metaForm, setMetaForm] = useState({ pageId: "", pageAccessToken: "" });
  const [a2pComplete, setA2pComplete] = useState(false);
  const [a2pSaving, setA2pSaving] = useState(false);

  const setupMode = integration.setupMode ?? "manual";
  const canConnect = hasRealConnect && setupMode !== "manual";

  async function markA2pComplete() {
    if (!businessId) return;
    setA2pSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/businesses/${businessId}/integrations/sms/a2p`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "complete" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(String(data.error ?? "Could not save A2P status."));
        return;
      }
      setA2pComplete(true);
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setA2pSaving(false);
    }
  }

  async function connectDevEmail() {
    if (!businessId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/businesses/${businessId}/integrations/business-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "dev" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(String(data.error ?? "Could not connect email."));
        return;
      }
      router.refresh();
      onClose();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function startOAuth() {
    if (!businessId) return;
    setLoading(true);
    setError(null);
    try {
      const path =
        integration.id === "calendar"
          ? `/api/businesses/${businessId}/integrations/calendar/oauth/start`
          : `/api/businesses/${businessId}/integrations/gmail/oauth/start`;
      const res = await fetch(path, { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.authorizeUrl) {
        setError(String(data.error ?? "Could not start connection."));
        setLoading(false);
        return;
      }
      window.location.href = String(data.authorizeUrl);
    } catch {
      setError("Network error. Please try again.");
      setLoading(false);
    }
  }

  async function connectApiKey() {
    if (!businessId) return;
    setLoading(true);
    setError(null);
    try {
      const path =
        integration.id === "voice_channel"
          ? `/api/businesses/${businessId}/integrations/voice`
          : `/api/businesses/${businessId}/integrations/sms`;
      const res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(apiKeyForm),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(String(data.error ?? "Could not connect."));
        return;
      }
      router.refresh();
      onClose();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function connectMeta() {
    if (!businessId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/businesses/${businessId}/integrations/meta`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(metaForm),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(String(data.error ?? "Could not connect Facebook."));
        return;
      }
      router.refresh();
      onClose();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function primaryAction() {
    if (!canConnect) return onClose;
    if (setupMode === "oauth" && integration.id !== "meta_lead_ads") return startOAuth;
    if (integration.id === "meta_lead_ads") return connectMeta;
    if (setupMode === "api_key") return connectApiKey;
    if (setupMode === "dev_connect") return connectDevEmail;
    return onClose;
  }

  function primaryLabel() {
    if (!canConnect) return "Got it";
    if (loading) return "Connecting…";
    if (setupMode === "oauth" && (integration.id === "business_email" || integration.id === "calendar")) {
      return "Connect with Google";
    }
    if (integration.id === "meta_lead_ads") return "Connect Facebook";
    if (setupMode === "dev_connect") return "Connect for development";
    return "Connect";
  }

  return (
    <SimpleModal
      title={`Connect ${integration.title}`}
      onClose={onClose}
      footer={
        canConnect ? (
          <>
            <SecondaryButton onClick={loading ? undefined : onClose}>Cancel</SecondaryButton>
            <PrimaryButton onClick={loading ? undefined : primaryAction()}>{primaryLabel()}</PrimaryButton>
          </>
        ) : (
          <PrimaryButton onClick={onClose}>Got it</PrimaryButton>
        )
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: spacing.md }}>
        <div style={{ display: "flex", alignItems: "center", gap: spacing.md }}>
          <span
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              backgroundColor: cockpitColors.accentMuted,
              color: cockpitColors.accent,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon size={20} />
          </span>
          <p style={{ ...typography.body, color: cockpitColors.textSecondary, margin: 0, lineHeight: 1.45 }}>{integration.description}</p>
        </div>

        <div
          style={{
            padding: spacing.md,
            borderRadius: 8,
            backgroundColor: cockpitColors.panelElevated,
            border: `1px solid ${cockpitColors.panelBorder}`,
          }}
        >
          {canConnect && setupMode === "api_key" ? (
            <div style={{ display: "flex", flexDirection: "column", gap: spacing.sm }}>
              <div style={{ fontWeight: 600, fontSize: typography.caption.fontSize, color: cockpitColors.textPrimary }}>
                Twilio credentials
              </div>
              <input
                placeholder="Account SID"
                value={apiKeyForm.accountSid}
                onChange={(e) => setApiKeyForm((s) => ({ ...s, accountSid: e.target.value }))}
                style={{ padding: 8, borderRadius: 6, border: `1px solid ${cockpitColors.panelBorder}` }}
              />
              <input
                placeholder="Auth Token"
                type="password"
                value={apiKeyForm.authToken}
                onChange={(e) => setApiKeyForm((s) => ({ ...s, authToken: e.target.value }))}
                style={{ padding: 8, borderRadius: 6, border: `1px solid ${cockpitColors.panelBorder}` }}
              />
              <input
                placeholder="From number (+1…)"
                value={apiKeyForm.fromNumber}
                onChange={(e) => setApiKeyForm((s) => ({ ...s, fromNumber: e.target.value }))}
                style={{ padding: 8, borderRadius: 6, border: `1px solid ${cockpitColors.panelBorder}` }}
              />
              {integration.id === "voice_channel" ? (
                <input
                  placeholder="TwiML webhook URL"
                  value={apiKeyForm.twimlUrl}
                  onChange={(e) => setApiKeyForm((s) => ({ ...s, twimlUrl: e.target.value }))}
                  style={{ padding: 8, borderRadius: 6, border: `1px solid ${cockpitColors.panelBorder}` }}
                />
              ) : null}
              {integration.id === "sms_channel" ? (
                <div style={{ marginTop: spacing.sm, display: "grid", gap: spacing.sm }}>
                  <div style={{ fontWeight: 600, fontSize: typography.caption.fontSize, color: cockpitColors.textPrimary }}>
                    A2P / 10DLC registration (required for US texting)
                  </div>
                  <ol style={{ margin: 0, paddingLeft: 18, color: cockpitColors.textSecondary, fontSize: typography.caption.fontSize, lineHeight: 1.55 }}>
                    <li>Connect Twilio credentials above</li>
                    <li>Complete brand registration in Twilio Console</li>
                    <li>Complete campaign registration and wait for A2P approval</li>
                    <li>Confirm here once registration is complete</li>
                  </ol>
                  <label style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: typography.caption.fontSize, color: cockpitColors.textSecondary }}>
                    <input
                      type="checkbox"
                      checked={a2pComplete}
                      disabled={a2pSaving}
                      onChange={(event) => {
                        if (event.target.checked) void markA2pComplete();
                        else setA2pComplete(false);
                      }}
                    />
                    <span>I&apos;ve finished Twilio A2P / 10DLC brand + campaign registration.</span>
                  </label>
                </div>
              ) : null}
            </div>
          ) : canConnect && integration.id === "meta_lead_ads" ? (
            <div style={{ display: "flex", flexDirection: "column", gap: spacing.sm }}>
              <div style={{ fontWeight: 600, fontSize: typography.caption.fontSize, color: cockpitColors.textPrimary }}>
                Facebook Page
              </div>
              <input
                placeholder="Page ID"
                value={metaForm.pageId}
                onChange={(e) => setMetaForm((s) => ({ ...s, pageId: e.target.value }))}
                style={{ padding: 8, borderRadius: 6, border: `1px solid ${cockpitColors.panelBorder}` }}
              />
              <input
                placeholder="Page access token"
                type="password"
                value={metaForm.pageAccessToken}
                onChange={(e) => setMetaForm((s) => ({ ...s, pageAccessToken: e.target.value }))}
                style={{ padding: 8, borderRadius: 6, border: `1px solid ${cockpitColors.panelBorder}` }}
              />
            </div>
          ) : canConnect ? (
            <>
              <div style={{ fontWeight: 600, fontSize: typography.caption.fontSize, color: cockpitColors.textPrimary }}>
                {integration.title}
              </div>
              <p style={{ ...typography.caption, color: cockpitColors.textSecondary, margin: `${spacing.xs} 0 0`, lineHeight: 1.5 }}>
                {setupMode === "oauth"
                  ? "You will sign in with Google and authorize VIBETech. Nothing sends without your approval."
                  : "Connect so AI teammates can draft messages for your approval before anything is sent."}
              </p>
            </>
          ) : (
            <>
              <div style={{ fontWeight: 600, fontSize: typography.caption.fontSize, color: cockpitColors.textPrimary }}>
                We&apos;ll set this up with you
              </div>
              <p style={{ ...typography.caption, color: cockpitColors.textSecondary, margin: `${spacing.xs} 0 0`, lineHeight: 1.5 }}>
                Connecting {integration.title.toLowerCase()} is part of your onboarding. Our team will walk you through setup and
                confirm everything is working before it goes live.
              </p>
            </>
          )}
          {error ? (
            <p style={{ color: "#b91c1c", margin: `${spacing.sm} 0 0`, fontSize: typography.caption.fontSize }}>{error}</p>
          ) : null}
        </div>
      </div>
    </SimpleModal>
  );
}
