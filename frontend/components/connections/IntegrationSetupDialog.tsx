"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import SimpleModal from "@/components/product/SimpleModal";
import PrimaryButton from "@/components/product/PrimaryButton";
import SecondaryButton from "@/components/product/SecondaryButton";
import type { IntegrationDisplay } from "./integrationDisplay";
import { cockpitColors, spacing, typography } from "@/design/tokens";
import { useBusinessScope } from "@/lib/platform/BusinessScopeContext";
import { resolveOAuthReturnPath } from "@/lib/connections/integrationFocusRouting.js";

export default function IntegrationSetupDialog({
  integration,
  hasRealConnect = false,
  onClose,
  returnTo = null,
}: {
  integration: IntegrationDisplay;
  hasRealConnect?: boolean;
  onClose: () => void;
  /** When set, navigate here after a successful connect (keeps Home → popup → Home). */
  returnTo?: string | null;
}) {
  const Icon = integration.icon;
  const router = useRouter();
  const searchParams = useSearchParams();
  const { businessId } = useBusinessScope();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [apiKeyForm, setApiKeyForm] = useState({
    accountSid: "",
    authToken: "",
    fromNumber: "",
    twimlUrl: "",
    serperApiKey: "",
    scrapingBeeApiKey: "",
    usePlatformKeys: false,
  });
  const [metaForm, setMetaForm] = useState({ pageId: "", pageAccessToken: "" });
  const [metaConnectResult, setMetaConnectResult] = useState<{
    webhookUrl?: string | null;
    subscribed?: boolean;
    subscribeWarning?: string | null;
    nextSteps?: string[];
  } | null>(null);
  const [growthForm, setGrowthForm] = useState({ customerId: "", developerToken: "", adAccountId: "", accessToken: "", loginCustomerId: "" });
  const [smsAdvanced, setSmsAdvanced] = useState(false);
  const [smsBrand, setSmsBrand] = useState({
    legalBusinessName: "",
    dba: "",
    website: "",
    ein: "",
    businessType: "LLC",
    businessIndustry: "HEALTHCARE",
    addressLine1: "",
    city: "",
    region: "",
    postalCode: "",
    areaCode: "",
    contactFirstName: "",
    contactLastName: "",
    contactEmail: "",
    contactPhone: "",
    contactTitle: "Owner",
    messageSample1: "",
    messageSample2: "",
    messageFlow: "",
    privacyPolicyUrl: "",
    termsUrl: "",
  });
  const [provisionResult, setProvisionResult] = useState<{
    fromNumber?: string;
    message?: string;
    simulated?: boolean;
  } | null>(null);

  const setupMode = integration.setupMode ?? "manual";
  const canConnect = hasRealConnect && setupMode !== "manual";
  const isBusinessEmail = integration.id === "business_email";
  const isGoogleOAuth =
    setupMode === "oauth"
    && (integration.id === "business_email" || integration.id === "calendar" || integration.id === "google_search_console");
  // Local skip only when Google OAuth is not available — never as an escape hatch
  // that marks email Connected without gmail.send.
  const allowLocalDesignPartnerConnect = isBusinessEmail && canConnect && setupMode === "dev_connect";
  const oauthReturnTo = resolveOAuthReturnPath(
    returnTo ?? searchParams.get("returnTo"),
    `/b/${businessId}/integrations`,
  );

  function finishConnected() {
    onClose();
    const preferred = returnTo ?? searchParams.get("returnTo");
    const dest = preferred ? resolveOAuthReturnPath(preferred, "") : "";
    if (dest) {
      // Stay on Home (or returnTo) after connect — don't leave the owner on Integrations.
      router.replace(`${dest}${dest.includes("?") ? "&" : "?"}connected=1`);
    }
    router.refresh();
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
      finishConnected();
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
          : integration.id === "google_search_console"
            ? `/api/businesses/${businessId}/integrations/search-console/oauth/start`
          : `/api/businesses/${businessId}/integrations/gmail/oauth/start`;
      const res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ returnTo: oauthReturnTo }),
      });
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

  async function provisionSms() {
    if (!businessId) return;
    setLoading(true);
    setError(null);
    setProvisionResult(null);
    try {
      const res = await fetch(`/api/businesses/${businessId}/integrations/sms/provision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brand: smsBrand }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(String(data.error ?? "Could not set up texting."));
        return;
      }
      setProvisionResult({
        fromNumber: data.fromNumber ? String(data.fromNumber) : undefined,
        message: data.message
          ? String(data.message)
          : (data.brandSaved ? "Business details saved." : undefined),
        simulated: data.simulated === true,
      });
      // Keep dialog open so owner sees the number + pending carrier step.
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function connectApiKey() {
    if (!businessId) return;
    if (integration.id === "sms_channel" && !smsAdvanced) {
      return provisionSms();
    }
    setLoading(true);
    setError(null);
    try {
      const path = integration.id === "google_ads"
        ? `/api/businesses/${businessId}/integrations/google-ads`
        : integration.id === "meta_ads"
          ? `/api/businesses/${businessId}/integrations/meta-ads`
          : integration.id === "voice_channel"
            ? `/api/businesses/${businessId}/integrations/voice`
            : integration.id === "social_screening"
              ? `/api/businesses/${businessId}/integrations/social-screening`
              : `/api/businesses/${businessId}/integrations/sms`;
      const res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          integration.id === "google_ads" || integration.id === "meta_ads"
            ? growthForm
            : integration.id === "social_screening"
              ? {
                usePlatformKeys: apiKeyForm.usePlatformKeys,
                ...(apiKeyForm.usePlatformKeys
                  ? {}
                  : {
                    serperApiKey: apiKeyForm.serperApiKey,
                    scrapingBeeApiKey: apiKeyForm.scrapingBeeApiKey,
                  }),
              }
              : integration.id === "sms_channel"
                ? { ...apiKeyForm }
                : apiKeyForm,
        ),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(String(data.error ?? "Could not connect."));
        return;
      }
      finishConnected();
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
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(String(data.error ?? "Could not connect Facebook."));
        return;
      }
      if (Array.isArray(data.nextSteps) && data.nextSteps.length) {
        setMetaConnectResult({
          webhookUrl: data.webhookUrl ? String(data.webhookUrl) : null,
          subscribed: data.subscribed === true,
          subscribeWarning: data.subscribeWarning ? String(data.subscribeWarning) : null,
          nextSteps: data.nextSteps.map(String),
        });
        router.refresh();
        return;
      }
      finishConnected();
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
    if (loading) {
      if (integration.id === "sms_channel" && !smsAdvanced) return "Setting up texting…";
      return "Connecting…";
    }
    if (setupMode === "oauth" && (integration.id === "business_email" || integration.id === "calendar" || integration.id === "google_search_console")) {
      return "Connect with Google";
    }
    if (integration.id === "meta_lead_ads") return "Connect Facebook";
    if (setupMode === "dev_connect") return "Connect for development";
    if (integration.id === "sms_channel" && !smsAdvanced) return "Set up texting for my business";
    return "Connect";
  }

  return (
    <SimpleModal
      title={
        isBusinessEmail
          ? "Choose your customer email inbox"
          : integration.id === "sms_channel"
            ? "Set up text messaging"
            : `Connect ${integration.title}`
      }
      onClose={onClose}
      maxWidth={integration.id === "sms_channel" || integration.id === "meta_lead_ads" ? 560 : 440}
      footer={
        canConnect && !(integration.id === "meta_lead_ads" && metaConnectResult) && !(integration.id === "sms_channel" && provisionResult) ? (
          <>
            <SecondaryButton onClick={loading ? undefined : onClose}>Cancel</SecondaryButton>
            {allowLocalDesignPartnerConnect ? (
              <SecondaryButton onClick={loading ? undefined : () => void connectDevEmail()}>
                {loading ? "Connecting…" : "Connect locally (skip Google)"}
              </SecondaryButton>
            ) : null}
            <PrimaryButton onClick={loading ? undefined : primaryAction()}>{primaryLabel()}</PrimaryButton>
          </>
        ) : canConnect && ((integration.id === "meta_lead_ads" && metaConnectResult) || (integration.id === "sms_channel" && provisionResult)) ? (
          <SecondaryButton onClick={onClose}>Close</SecondaryButton>
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

        {isGoogleOAuth ? (
          <div
            style={{
              padding: spacing.md,
              borderRadius: 8,
              backgroundColor: "#fffbeb",
              border: "1px solid #fcd34d",
              color: "#92400e",
              fontSize: typography.caption.fontSize,
              lineHeight: 1.45,
            }}
          >
            Google blocked? Add your Gmail as a test user in Google Cloud → OAuth consent screen
            {allowLocalDesignPartnerConnect ? (
              <>
                , or tap <strong>Connect locally</strong>
              </>
            ) : null}
            . On Google’s screen, approve <strong>Send email on your behalf</strong> before Continue.
          </div>
        ) : null}

        <div
          style={{
            padding: spacing.md,
            borderRadius: 8,
            backgroundColor: cockpitColors.panelElevated,
            border: `1px solid ${cockpitColors.panelBorder}`,
          }}
        >
          {canConnect && setupMode === "api_key" && (integration.id === "google_ads" || integration.id === "meta_ads") ? (
            <div style={{ display: "flex", flexDirection: "column", gap: spacing.sm }}>
              <div style={{ fontWeight: 600, fontSize: typography.caption.fontSize, color: cockpitColors.textPrimary }}>{integration.id === "google_ads" ? "Google Ads credentials" : "Meta Ads credentials"}</div>
              <input placeholder={integration.id === "google_ads" ? "Google Ads customer ID" : "Meta ad account ID"} value={integration.id === "google_ads" ? growthForm.customerId : growthForm.adAccountId} onChange={(e) => setGrowthForm((s) => integration.id === "google_ads" ? { ...s, customerId: e.target.value } : { ...s, adAccountId: e.target.value })} style={{ padding: 8, borderRadius: 6, border: `1px solid ${cockpitColors.panelBorder}` }} />
              {integration.id === "google_ads" ? <><input placeholder="Google Ads developer token" type="password" value={growthForm.developerToken} onChange={(e) => setGrowthForm((s) => ({ ...s, developerToken: e.target.value }))} style={{ padding: 8, borderRadius: 6, border: `1px solid ${cockpitColors.panelBorder}` }} /><input placeholder="Optional manager account ID" value={growthForm.loginCustomerId} onChange={(e) => setGrowthForm((s) => ({ ...s, loginCustomerId: e.target.value }))} style={{ padding: 8, borderRadius: 6, border: `1px solid ${cockpitColors.panelBorder}` }} /></> : null}
              <input placeholder="Access token" type="password" value={growthForm.accessToken} onChange={(e) => setGrowthForm((s) => ({ ...s, accessToken: e.target.value }))} style={{ padding: 8, borderRadius: 6, border: `1px solid ${cockpitColors.panelBorder}` }} />
            </div>
          ) : canConnect && setupMode === "api_key" && integration.id === "sms_channel" ? (
            <div style={{ display: "flex", flexDirection: "column", gap: spacing.sm }}>
              {!smsAdvanced ? (
                <>
                  <div style={{ fontWeight: 600, fontSize: typography.caption.fontSize, color: cockpitColors.textPrimary }}>
                    A2P business + messaging details
                  </div>
                  <p style={{ margin: 0, fontSize: 12, color: cockpitColors.textMuted, lineHeight: 1.45 }}>
                    Carriers require this to approve US texting. Exact legal name + EIN must match IRS records. VIBETech provisions the number; brand/campaign registration uses what you enter here.
                  </p>

                  <div style={{ fontWeight: 700, fontSize: 12, color: cockpitColors.textPrimary, marginTop: 4 }}>Brand</div>
                  <label style={fieldLabelStyle}>
                    Legal business name
                    <span style={fieldHintStyle}>Exact name on the EIN / CP-575 letter</span>
                    <input
                      placeholder="Abc Dentistry LLC"
                      value={smsBrand.legalBusinessName}
                      onChange={(e) => setSmsBrand((s) => ({ ...s, legalBusinessName: e.target.value }))}
                      style={fieldInputStyle}
                    />
                  </label>
                  <label style={fieldLabelStyle}>
                    Doing business as (optional)
                    <input
                      placeholder="Abc Dentistry"
                      value={smsBrand.dba}
                      onChange={(e) => setSmsBrand((s) => ({ ...s, dba: e.target.value }))}
                      style={fieldInputStyle}
                    />
                  </label>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: spacing.sm }}>
                    <label style={fieldLabelStyle}>
                      Entity type
                      <select
                        value={smsBrand.businessType}
                        onChange={(e) => setSmsBrand((s) => ({ ...s, businessType: e.target.value }))}
                        style={fieldInputStyle}
                      >
                        <option value="LLC">LLC</option>
                        <option value="Corporation">Corporation</option>
                        <option value="Partnership">Partnership</option>
                        <option value="Sole Proprietorship">Sole proprietorship</option>
                        <option value="Non-profit">Non-profit</option>
                      </select>
                    </label>
                    <label style={fieldLabelStyle}>
                      Industry
                      <select
                        value={smsBrand.businessIndustry}
                        onChange={(e) => setSmsBrand((s) => ({ ...s, businessIndustry: e.target.value }))}
                        style={fieldInputStyle}
                      >
                        <option value="HEALTHCARE">Healthcare</option>
                        <option value="PROFESSIONAL">Professional services</option>
                        <option value="RETAIL">Retail</option>
                        <option value="EDUCATION">Education / sports</option>
                        <option value="REAL_ESTATE">Real estate</option>
                        <option value="OTHER">Other</option>
                      </select>
                    </label>
                  </div>
                  <label style={fieldLabelStyle}>
                    EIN / tax ID
                    <span style={fieldHintStyle}>Required for LLC/Corp — XX-XXXXXXX</span>
                    <input
                      placeholder="12-3456789"
                      value={smsBrand.ein}
                      onChange={(e) => setSmsBrand((s) => ({ ...s, ein: e.target.value }))}
                      style={fieldInputStyle}
                    />
                  </label>
                  <label style={fieldLabelStyle}>
                    Business website
                    <span style={fieldHintStyle}>Live site that matches the business name</span>
                    <input
                      placeholder="https://"
                      value={smsBrand.website}
                      onChange={(e) => setSmsBrand((s) => ({ ...s, website: e.target.value }))}
                      style={fieldInputStyle}
                    />
                  </label>
                  <label style={fieldLabelStyle}>
                    Street address
                    <input
                      placeholder="1 Main St"
                      value={smsBrand.addressLine1}
                      onChange={(e) => setSmsBrand((s) => ({ ...s, addressLine1: e.target.value }))}
                      style={fieldInputStyle}
                    />
                  </label>
                  <div style={{ display: "grid", gridTemplateColumns: "1.4fr 0.7fr 0.9fr", gap: spacing.sm }}>
                    <label style={fieldLabelStyle}>
                      City
                      <input
                        value={smsBrand.city}
                        onChange={(e) => setSmsBrand((s) => ({ ...s, city: e.target.value }))}
                        style={fieldInputStyle}
                      />
                    </label>
                    <label style={fieldLabelStyle}>
                      State
                      <input
                        placeholder="NH"
                        value={smsBrand.region}
                        onChange={(e) => setSmsBrand((s) => ({ ...s, region: e.target.value }))}
                        style={fieldInputStyle}
                      />
                    </label>
                    <label style={fieldLabelStyle}>
                      ZIP
                      <input
                        value={smsBrand.postalCode}
                        onChange={(e) => setSmsBrand((s) => ({ ...s, postalCode: e.target.value }))}
                        style={fieldInputStyle}
                      />
                    </label>
                  </div>

                  <div style={{ fontWeight: 700, fontSize: 12, color: cockpitColors.textPrimary, marginTop: 8 }}>Authorized contact</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: spacing.sm }}>
                    <label style={fieldLabelStyle}>
                      First name
                      <input
                        value={smsBrand.contactFirstName}
                        onChange={(e) => setSmsBrand((s) => ({ ...s, contactFirstName: e.target.value }))}
                        style={fieldInputStyle}
                      />
                    </label>
                    <label style={fieldLabelStyle}>
                      Last name
                      <input
                        value={smsBrand.contactLastName}
                        onChange={(e) => setSmsBrand((s) => ({ ...s, contactLastName: e.target.value }))}
                        style={fieldInputStyle}
                      />
                    </label>
                  </div>
                  <label style={fieldLabelStyle}>
                    Job title
                    <input
                      placeholder="Owner"
                      value={smsBrand.contactTitle}
                      onChange={(e) => setSmsBrand((s) => ({ ...s, contactTitle: e.target.value }))}
                      style={fieldInputStyle}
                    />
                  </label>
                  <label style={fieldLabelStyle}>
                    Work email
                    <input
                      type="email"
                      placeholder="owner@practice.com"
                      value={smsBrand.contactEmail}
                      onChange={(e) => setSmsBrand((s) => ({ ...s, contactEmail: e.target.value }))}
                      style={fieldInputStyle}
                    />
                  </label>
                  <label style={fieldLabelStyle}>
                    Mobile phone
                    <span style={fieldHintStyle}>E.164, e.g. +16035551212 — used for verification</span>
                    <input
                      placeholder="+1…"
                      value={smsBrand.contactPhone}
                      onChange={(e) => setSmsBrand((s) => ({ ...s, contactPhone: e.target.value }))}
                      style={fieldInputStyle}
                    />
                  </label>

                  <div style={{ fontWeight: 700, fontSize: 12, color: cockpitColors.textPrimary, marginTop: 8 }}>Campaign (what you text)</div>
                  <label style={fieldLabelStyle}>
                    How do people opt in?
                    <span style={fieldHintStyle}>Website form, in-person, keyword — include privacy/terms links if on a site</span>
                    <textarea
                      rows={3}
                      placeholder="Patients opt in by adding their mobile on our website intake form and checking a box to receive appointment texts…"
                      value={smsBrand.messageFlow}
                      onChange={(e) => setSmsBrand((s) => ({ ...s, messageFlow: e.target.value }))}
                      style={{ ...fieldInputStyle, resize: "vertical" as const }}
                    />
                  </label>
                  <label style={fieldLabelStyle}>
                    Sample text 1
                    <input
                      placeholder="Abc Dentistry: your cleaning is tomorrow at 10am. Reply STOP to opt out."
                      value={smsBrand.messageSample1}
                      onChange={(e) => setSmsBrand((s) => ({ ...s, messageSample1: e.target.value }))}
                      style={fieldInputStyle}
                    />
                  </label>
                  <label style={fieldLabelStyle}>
                    Sample text 2
                    <input
                      placeholder="Abc Dentistry: reply YES to confirm your follow-up visit."
                      value={smsBrand.messageSample2}
                      onChange={(e) => setSmsBrand((s) => ({ ...s, messageSample2: e.target.value }))}
                      style={fieldInputStyle}
                    />
                  </label>
                  <label style={fieldLabelStyle}>
                    Privacy policy URL (optional but recommended)
                    <input
                      placeholder="https://…/privacy"
                      value={smsBrand.privacyPolicyUrl}
                      onChange={(e) => setSmsBrand((s) => ({ ...s, privacyPolicyUrl: e.target.value }))}
                      style={fieldInputStyle}
                    />
                  </label>
                  <label style={fieldLabelStyle}>
                    Terms URL (optional but recommended)
                    <input
                      placeholder="https://…/terms"
                      value={smsBrand.termsUrl}
                      onChange={(e) => setSmsBrand((s) => ({ ...s, termsUrl: e.target.value }))}
                      style={fieldInputStyle}
                    />
                  </label>
                  <label style={fieldLabelStyle}>
                    Preferred area code (optional)
                    <input
                      placeholder="603"
                      value={smsBrand.areaCode}
                      onChange={(e) => setSmsBrand((s) => ({ ...s, areaCode: e.target.value }))}
                      style={fieldInputStyle}
                    />
                  </label>
                  {provisionResult ? (
                    <div style={{
                      display: "grid",
                      gap: 8,
                      padding: 12,
                      borderRadius: 12,
                      border: "1px solid #a7f3d0",
                      background: "#ecfdf5",
                    }}>
                      {provisionResult.fromNumber ? (
                        <p style={{ margin: 0, fontSize: 14, color: "#047857", fontWeight: 700 }}>
                          Number ready: {provisionResult.fromNumber}
                          {provisionResult.simulated ? " (simulated — not a live Twilio number)" : ""}
                        </p>
                      ) : null}
                      <p style={{ margin: 0, fontSize: 13, color: "#065f46", fontWeight: 600, lineHeight: 1.45 }}>
                        {provisionResult.message
                          || "Business details saved. Carrier brand/campaign registration is still pending — US customer texts may wait until approval."}
                      </p>
                      <PrimaryButton onClick={() => finishConnected()}>
                        Continue — send a test text next
                      </PrimaryButton>
                    </div>
                  ) : null}
                  {!provisionResult ? (
                  <button
                    type="button"
                    onClick={() => { setSmsAdvanced(true); setError(null); }}
                    style={{
                      border: "none",
                      background: "transparent",
                      color: cockpitColors.textMuted,
                      fontSize: 12,
                      fontWeight: 650,
                      cursor: "pointer",
                      padding: 0,
                      textAlign: "left",
                    }}
                  >
                    I already have my own Twilio account →
                  </button>
                  ) : null}
                </>
              ) : (
                <>
                  <div style={{ fontWeight: 600, fontSize: typography.caption.fontSize, color: cockpitColors.textPrimary }}>
                    Paste your Twilio credentials
                  </div>
                  <p style={{ margin: 0, fontSize: 12, color: cockpitColors.textMuted, lineHeight: 1.45 }}>
                    Advanced — most businesses can skip this and use VIBETech provisioning instead.
                  </p>
                  <label style={fieldLabelStyle}>
                    Account SID
                    <input
                      placeholder="ACxxxxxxxx"
                      value={apiKeyForm.accountSid}
                      onChange={(e) => setApiKeyForm((s) => ({ ...s, accountSid: e.target.value }))}
                      style={fieldInputStyle}
                    />
                  </label>
                  <label style={fieldLabelStyle}>
                    Auth Token
                    <input
                      placeholder="Auth Token"
                      type="password"
                      value={apiKeyForm.authToken}
                      onChange={(e) => setApiKeyForm((s) => ({ ...s, authToken: e.target.value }))}
                      style={fieldInputStyle}
                    />
                  </label>
                  <label style={fieldLabelStyle}>
                    From number
                    <input
                      placeholder="+1…"
                      value={apiKeyForm.fromNumber}
                      onChange={(e) => setApiKeyForm((s) => ({ ...s, fromNumber: e.target.value }))}
                      style={fieldInputStyle}
                    />
                  </label>
                  <p style={{ fontSize: typography.caption.fontSize, color: cockpitColors.textSecondary, margin: 0, lineHeight: 1.45 }}>
                    A2P / 10DLC status syncs from Twilio after you save business details (not a checkbox). Use Refresh A2P on the SMS connection when carriers update.
                  </p>
                  <button
                    type="button"
                    onClick={() => { setSmsAdvanced(false); setError(null); }}
                    style={{
                      border: "none",
                      background: "transparent",
                      color: cockpitColors.textMuted,
                      fontSize: 12,
                      fontWeight: 650,
                      cursor: "pointer",
                      padding: 0,
                      textAlign: "left",
                    }}
                  >
                    ← Back to VIBETech setup
                  </button>
                </>
              )}
            </div>
          ) : canConnect && setupMode === "api_key" && integration.id === "voice_channel" ? (
            <div style={{ display: "flex", flexDirection: "column", gap: spacing.sm }}>
              <div style={{ fontWeight: 600, fontSize: typography.caption.fontSize, color: cockpitColors.textPrimary }}>
                Twilio credentials
              </div>
              <p style={{ margin: 0, fontSize: 12, color: cockpitColors.textMuted, lineHeight: 1.45 }}>
                In Twilio Console, open the account menu (top-left) → <strong>API keys & tokens</strong> (or Account → Account info).
              </p>
              <label style={fieldLabelStyle}>
                Account SID
                <span style={fieldHintStyle}>Starts with AC… — copy from Account info</span>
                <input
                  placeholder="ACxxxxxxxx"
                  value={apiKeyForm.accountSid}
                  onChange={(e) => setApiKeyForm((s) => ({ ...s, accountSid: e.target.value }))}
                  style={fieldInputStyle}
                />
              </label>
              <label style={fieldLabelStyle}>
                Auth Token
                <span style={fieldHintStyle}>Click Show next to Auth Token, then copy</span>
                <input
                  placeholder="Auth Token"
                  type="password"
                  value={apiKeyForm.authToken}
                  onChange={(e) => setApiKeyForm((s) => ({ ...s, authToken: e.target.value }))}
                  style={fieldInputStyle}
                />
              </label>
              <label style={fieldLabelStyle}>
                From number
                <span style={fieldHintStyle}>Phone Numbers → Manage → Active numbers → copy your +1 number</span>
                <input
                  placeholder="+1…"
                  value={apiKeyForm.fromNumber}
                  onChange={(e) => setApiKeyForm((s) => ({ ...s, fromNumber: e.target.value }))}
                  style={fieldInputStyle}
                />
              </label>
              <label style={fieldLabelStyle}>
                TwiML webhook URL
                <span style={fieldHintStyle}>Optional for now — leave blank unless you have a voice webhook</span>
                <input
                  placeholder="https://…"
                  value={apiKeyForm.twimlUrl}
                  onChange={(e) => setApiKeyForm((s) => ({ ...s, twimlUrl: e.target.value }))}
                  style={fieldInputStyle}
                />
              </label>
            </div>
          ) : canConnect && setupMode === "api_key" && integration.id === "social_screening" ? (
            <div style={{ display: "flex", flexDirection: "column", gap: spacing.sm }}>
              <div style={{ fontWeight: 600, fontSize: typography.caption.fontSize, color: cockpitColors.textPrimary }}>
                Social screening keys
              </div>
              <p style={{ margin: 0, fontSize: 12, color: cockpitColors.textMuted, lineHeight: 1.45 }}>
                Public-web discovery uses Serper; page fetch uses ScrapingBee. Reports are FCRA-filtered for owner review only.
              </p>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 650 }}>
                <input
                  type="checkbox"
                  checked={apiKeyForm.usePlatformKeys}
                  onChange={(e) => setApiKeyForm((s) => ({ ...s, usePlatformKeys: e.target.checked }))}
                />
                Use platform keys (SERPER_API_KEY + SCRAPINGBEE_API_KEY)
              </label>
              {!apiKeyForm.usePlatformKeys ? (
                <>
                  <label style={fieldLabelStyle}>
                    Serper API key
                    <input
                      placeholder="Serper key"
                      type="password"
                      value={apiKeyForm.serperApiKey}
                      onChange={(e) => setApiKeyForm((s) => ({ ...s, serperApiKey: e.target.value }))}
                      style={fieldInputStyle}
                    />
                  </label>
                  <label style={fieldLabelStyle}>
                    ScrapingBee API key
                    <input
                      placeholder="ScrapingBee key"
                      type="password"
                      value={apiKeyForm.scrapingBeeApiKey}
                      onChange={(e) => setApiKeyForm((s) => ({ ...s, scrapingBeeApiKey: e.target.value }))}
                      style={fieldInputStyle}
                    />
                  </label>
                </>
              ) : null}
            </div>
          ) : canConnect && integration.id === "meta_lead_ads" ? (
            <div style={{ display: "flex", flexDirection: "column", gap: spacing.sm }}>
              {metaConnectResult ? (
                <div style={{
                  display: "grid",
                  gap: 10,
                  padding: 12,
                  borderRadius: 12,
                  border: "1px solid #a7f3d0",
                  background: "#ecfdf5",
                }}>
                  <div style={{ fontWeight: 800, color: "#047857" }}>
                    Facebook Page connected
                    {metaConnectResult.subscribed ? " · leadgen subscribed" : ""}
                  </div>
                  {metaConnectResult.subscribeWarning ? (
                    <p style={{ margin: 0, fontSize: 12, color: "#b45309", fontWeight: 650 }}>
                      Page subscribe warning: {metaConnectResult.subscribeWarning}. You can still finish webhook setup below.
                    </p>
                  ) : null}
                  {metaConnectResult.webhookUrl ? (
                    <p style={{ margin: 0, fontSize: 12, color: "#065f46", fontWeight: 650, wordBreak: "break-all" }}>
                      Webhook URL: {metaConnectResult.webhookUrl}
                    </p>
                  ) : null}
                  <ol style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: "#065f46", lineHeight: 1.5, fontWeight: 600 }}>
                    {(metaConnectResult.nextSteps ?? []).map((step) => (
                      <li key={step}>{step}</li>
                    ))}
                  </ol>
                  <PrimaryButton onClick={() => finishConnected()}>
                    Done — send a test lead next
                  </PrimaryButton>
                </div>
              ) : (
                <>
                  <div style={{ fontWeight: 700, fontSize: 14, color: cockpitColors.textPrimary }}>
                    Connect Facebook Lead Ads (step-by-step)
                  </div>
                  <div style={{
                    fontSize: 12,
                    color: cockpitColors.textSecondary,
                    lineHeight: 1.5,
                    padding: 10,
                    borderRadius: 10,
                    border: `1px solid ${cockpitColors.panelBorder}`,
                    background: "#fafaf9",
                  }}>
                    <div style={{ fontWeight: 800, marginBottom: 6, color: cockpitColors.textPrimary }}>
                      If you’ve never run a Facebook Lead Ad
                    </div>
                    <ol style={{ margin: 0, paddingLeft: 18 }}>
                      <li>Go to <strong>facebook.com/adsmanager</strong> (same Facebook login that manages your business Page).</li>
                      <li>Click <strong>+ Create</strong> → objective <strong>Leads</strong> (not Traffic/Engagement).</li>
                      <li>Choose your <strong>Facebook Page</strong> → Instant Form / Lead form → collect <strong>name, email, phone</strong>.</li>
                      <li>Add privacy policy URL (required by Meta) → Publish the form.</li>
                      <li>Set a small daily budget (e.g. $5–$20) → place the ad. Even one test lead is enough to prove the pipeline.</li>
                    </ol>
                    <div style={{ fontWeight: 800, margin: "10px 0 6px", color: cockpitColors.textPrimary }}>
                      Then connect that Page here
                    </div>
                    <ol style={{ margin: 0, paddingLeft: 18 }}>
                      <li>Open <strong>developers.facebook.com</strong> → your app (or create one) → <strong>Tools → Graph API Explorer</strong>.</li>
                      <li>Select your app → Get User Token → add permissions: <code>pages_show_list</code>, <code>pages_read_engagement</code>, <code>leads_retrieval</code>, <code>pages_manage_metadata</code>.</li>
                      <li>Call <code>GET /me/accounts</code> → copy the Page <strong>id</strong> and that Page’s <strong>access_token</strong>.</li>
                      <li>Paste both below → Connect. VIBETech will try to subscribe the Page to <code>leadgen</code> automatically.</li>
                      <li>In the Meta app <strong>Webhooks</strong>, add the callback URL we show after connect (leadgen field).</li>
                    </ol>
                    <p style={{ margin: "10px 0 0", fontWeight: 650 }}>
                      After that: every new Facebook lead lands in <strong>People</strong>, opens a pipeline card when available, and fires your <strong>META_LEAD</strong> automations (drafts for your approval — nothing texts/emails customers until you GRANT).
                    </p>
                  </div>
                  <label style={fieldLabelStyle}>
                    Page ID
                    <span style={fieldHintStyle}>From Graph API GET /me/accounts → id</span>
                    <input
                      placeholder="Page ID"
                      value={metaForm.pageId}
                      onChange={(e) => setMetaForm((s) => ({ ...s, pageId: e.target.value }))}
                      style={fieldInputStyle}
                    />
                  </label>
                  <label style={fieldLabelStyle}>
                    Page access token
                    <span style={fieldHintStyle}>Long-lived Page token with leads_retrieval</span>
                    <input
                      placeholder="Page access token"
                      type="password"
                      value={metaForm.pageAccessToken}
                      onChange={(e) => setMetaForm((s) => ({ ...s, pageAccessToken: e.target.value }))}
                      style={fieldInputStyle}
                    />
                  </label>
                </>
              )}
            </div>
          ) : canConnect ? (
            <>
              <div style={{ fontWeight: 700, fontSize: 15, color: cockpitColors.textPrimary }}>
                {isBusinessEmail ? "Pick the inbox you use for customers" : integration.title}
              </div>
              <p style={{ ...typography.caption, color: cockpitColors.textSecondary, margin: `${spacing.xs} 0 0`, lineHeight: 1.45 }}>
                {isBusinessEmail
                  ? "Nothing sends without your OK."
                  : setupMode === "oauth"
                  ? "Sign in with Google. Nothing sends without your OK."
                  : "Connect this tool."}
              </p>
              {isGoogleOAuth ? (
                <p style={{ ...typography.caption, color: cockpitColors.textMuted, margin: `${spacing.sm} 0 0`, lineHeight: 1.45 }}>
                  After Google, click <strong>Run test</strong> on Home — connect alone is not proven.
                </p>
              ) : null}
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

const fieldLabelStyle = {
  display: "grid",
  gap: 4,
  fontSize: 13,
  fontWeight: 700,
  color: cockpitColors.textPrimary,
} as const;

const fieldHintStyle = {
  fontSize: 12,
  fontWeight: 500,
  color: cockpitColors.textMuted,
  lineHeight: 1.4,
} as const;

const fieldInputStyle = {
  padding: 8,
  borderRadius: 6,
  border: `1px solid ${cockpitColors.panelBorder}`,
  fontWeight: 500,
} as const;
