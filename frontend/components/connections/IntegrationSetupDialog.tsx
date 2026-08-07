"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import SimpleModal from "@/components/product/SimpleModal";
import PrimaryButton from "@/components/product/PrimaryButton";
import SecondaryButton from "@/components/product/SecondaryButton";
import type { IntegrationDisplay } from "./integrationDisplay";
import SmsProvisioningStatus, { resolveSmsProvisioningStage } from "./SmsProvisioningStatus";
import { cockpitColors, spacing, typography } from "@/design/tokens";
import { useBusinessScope } from "@/lib/platform/BusinessScopeContext";
import { resolveOAuthReturnPath } from "@/lib/connections/integrationFocusRouting.js";

export default function IntegrationSetupDialog({
  integration,
  hasRealConnect = false,
  onClose,
  returnTo = null,
  onMetaSetupRequested,
}: {
  integration: IntegrationDisplay;
  hasRealConnect?: boolean;
  onClose: () => void;
  /** When set, navigate here after a successful connect (keeps Home → popup → Home). */
  returnTo?: string | null;
  /** Home Launch Center: flip Mission 6 to Pending without a full refresh. */
  onMetaSetupRequested?: (() => void) | null;
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
    forwardNumber: "",
    missedCallFollowUpEnabled: true,
    ringTimeoutSeconds: "20",
    serperApiKey: "",
    scrapingBeeApiKey: "",
    apolloApiKey: "",
    hunterApiKey: "",
    usePlatformKeys: false,
  });
  const [metaForm, setMetaForm] = useState({
    pageName: "",
    pageUrl: "",
    notes: "",
    /** "have_page" | "need_everything" — most clients know their Page name; some have no FB yet. */
    startingPoint: "have_page" as "have_page" | "need_everything",
  });
  const [metaRequestResult, setMetaRequestResult] = useState<{
    message?: string;
    emailed?: boolean;
    operatorEmail?: string;
  } | null>(null);
  const [growthForm, setGrowthForm] = useState({ customerId: "", developerToken: "", adAccountId: "", accessToken: "", loginCustomerId: "" });
  const [crmForm, setCrmForm] = useState({ accessToken: "", locationId: "" });
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
    a2pRegistrationStatus?: string | null;
    inboundWebhookConfigured?: boolean | null;
  } | null>(null);
  const [voiceConnectResult, setVoiceConnectResult] = useState<{
    fromNumber?: string;
    inboundUrl?: string;
    nextSteps?: string[];
    voiceWebhookConfigured?: boolean;
    missedCallFollowUp?: { active?: boolean; forwardNumber?: string | null };
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
  const showMicrosoftOAuthOption =
    canConnect
    && setupMode === "oauth"
    && Boolean(integration.microsoftOAuthAvailable)
    && (integration.id === "business_email" || integration.id === "calendar");
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

  async function startMicrosoftOAuth() {
    if (!businessId) return;
    setLoading(true);
    setError(null);
    try {
      const path =
        integration.id === "calendar"
          ? `/api/businesses/${businessId}/integrations/outlook-calendar/oauth/start`
          : `/api/businesses/${businessId}/integrations/outlook/oauth/start`;
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
        a2pRegistrationStatus: data.a2pRegistrationStatus ? String(data.a2pRegistrationStatus) : null,
        inboundWebhookConfigured: typeof data.inboundWebhookConfigured === "boolean" ? data.inboundWebhookConfigured : null,
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
              : integration.id === "prospecting_enrichment"
                ? `/api/businesses/${businessId}/integrations/prospecting-enrichment`
              : integration.id === "hubspot" || integration.id === "highlevel"
                ? `/api/businesses/${businessId}/integrations/crm`
              : `/api/businesses/${businessId}/integrations/sms`;
      const res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          integration.id === "google_ads" || integration.id === "meta_ads"
            ? growthForm
            : integration.id === "hubspot" || integration.id === "highlevel"
              ? {
                provider: integration.id,
                accessToken: crmForm.accessToken,
                locationId: integration.id === "highlevel" ? crmForm.locationId : null,
              }
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
              : integration.id === "prospecting_enrichment"
                ? {
                  usePlatformKeys: apiKeyForm.usePlatformKeys,
                  ...(apiKeyForm.usePlatformKeys
                    ? {}
                    : {
                      apolloApiKey: apiKeyForm.apolloApiKey,
                      hunterApiKey: apiKeyForm.hunterApiKey,
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
      if (integration.id === "voice_channel") {
        setVoiceConnectResult({
          fromNumber: data.fromNumber,
          inboundUrl: data.inboundUrl,
          nextSteps: Array.isArray(data.nextSteps) ? data.nextSteps : [],
          voiceWebhookConfigured: Boolean(data.voiceWebhookConfigured),
          missedCallFollowUp: data.missedCallFollowUp ?? null,
        });
        return;
      }
      finishConnected();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function requestMetaSetup() {
    if (!businessId) return;
    setLoading(true);
    setError(null);
    try {
      const needEverything = metaForm.startingPoint === "need_everything";
      const res = await fetch(`/api/businesses/${businessId}/integrations/meta/request-setup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pageName: needEverything ? "" : metaForm.pageName,
          pageUrl: needEverything ? "" : metaForm.pageUrl,
          notes: metaForm.notes,
          needEverything,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(String(data.error ?? "Could not send setup request."));
        return;
      }
      setMetaRequestResult({
        message: String(data.message ?? "VIBETech will connect your Facebook Page."),
        emailed: data.emailed === true,
        operatorEmail: data.operatorEmail ? String(data.operatorEmail) : "leopiandes@vtechdevelopment.com",
      });
      // Flip Mission 6 to Pending immediately (parent). Avoid router.refresh() —
      // a pending package-Ask heal used to soft-nav into /architect?packageAsk=1.
      onMetaSetupRequested?.();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function primaryAction() {
    if (!canConnect) return onClose;
    if (setupMode === "oauth" && integration.id !== "meta_lead_ads") return startOAuth;
    if (integration.id === "meta_lead_ads") return requestMetaSetup;
    if (setupMode === "api_key") return connectApiKey;
    if (setupMode === "dev_connect") return connectDevEmail;
    return onClose;
  }

  function primaryLabel() {
    if (!canConnect) return "Got it";
    if (loading) {
      if (integration.id === "sms_channel" && !smsAdvanced) return "Setting up texting…";
      if (integration.id === "meta_lead_ads") return "Sending request…";
      return "Connecting…";
    }
    if (setupMode === "oauth" && (integration.id === "business_email" || integration.id === "calendar" || integration.id === "google_search_console")) {
      return "Connect with Google";
    }
    if (integration.id === "meta_lead_ads") return "Request VIBETech setup";
    if (setupMode === "dev_connect") return "Connect for development";
    if (integration.id === "sms_channel" && !smsAdvanced) return "Set up texting for my business";
    return "Connect";
  }

  return (
    <SimpleModal
      title={
        isBusinessEmail
          ? "Connect business email"
          : integration.id === "sms_channel"
            ? "Set up text messaging"
            : integration.id === "meta_lead_ads"
              ? "Request Meta Lead Forms setup"
              : integration.id === "voice_channel"
                ? "Set up missed-call texts"
              : integration.id === "calendar"
                ? "Connect calendar"
              : `Connect ${integration.title}`
      }
      onClose={onClose}
      maxWidth={integration.id === "sms_channel" || integration.id === "meta_lead_ads" || integration.id === "voice_channel" ? 560 : 440}
      footer={
        canConnect && !(integration.id === "meta_lead_ads" && metaRequestResult) && !(integration.id === "sms_channel" && provisionResult) && !(integration.id === "voice_channel" && voiceConnectResult) ? (
          <>
            <SecondaryButton onClick={loading ? undefined : onClose}>Cancel</SecondaryButton>
            {allowLocalDesignPartnerConnect ? (
              <SecondaryButton onClick={loading ? undefined : () => void connectDevEmail()}>
                {loading ? "Connecting…" : "Connect locally (skip Google)"}
              </SecondaryButton>
            ) : null}
            {showMicrosoftOAuthOption ? (
              <SecondaryButton onClick={loading ? undefined : () => void startMicrosoftOAuth()}>
                {loading ? "Connecting…" : "Connect with Microsoft"}
              </SecondaryButton>
            ) : null}
            <PrimaryButton onClick={loading ? undefined : primaryAction()}>{primaryLabel()}</PrimaryButton>
          </>
        ) : canConnect && ((integration.id === "meta_lead_ads" && metaRequestResult) || (integration.id === "sms_channel" && provisionResult) || (integration.id === "voice_channel" && voiceConnectResult)) ? (
          <SecondaryButton onClick={integration.id === "voice_channel" ? finishConnected : onClose}>Close</SecondaryButton>
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
          <p style={{ margin: 0, color: cockpitColors.textSecondary, fontSize: 14, lineHeight: 1.45 }}>
            {integration.id === "business_email"
              ? `You’ll sign in with Google. Nothing sends until you approve it.${showMicrosoftOAuthOption ? " Use Outlook or Microsoft 365 instead? Connect with Microsoft below." : ""}`
              : integration.id === "calendar"
                ? `You’ll sign in with Google to sync this business calendar.${showMicrosoftOAuthOption ? " Use Outlook Calendar instead? Connect with Microsoft below." : ""}`
                : "You’ll sign in with Google on the next screen."}
          </p>
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
          ) : canConnect && setupMode === "api_key" && (integration.id === "hubspot" || integration.id === "highlevel") ? (
            <div style={{ display: "flex", flexDirection: "column", gap: spacing.sm }}>
              <div style={{ fontWeight: 600, fontSize: typography.caption.fontSize, color: cockpitColors.textPrimary }}>
                {integration.id === "hubspot" ? "HubSpot private app token" : "HighLevel API credentials"}
              </div>
              <p style={{ margin: 0, fontSize: 12, color: cockpitColors.textMuted, lineHeight: 1.45 }}>
                Connected is not Proven — after connect, run Prove it works to create a real CRM contact id.
              </p>
              <input
                placeholder={integration.id === "hubspot" ? "Private app access token" : "API key"}
                type="password"
                value={crmForm.accessToken}
                onChange={(e) => setCrmForm((s) => ({ ...s, accessToken: e.target.value }))}
                style={{ padding: 8, borderRadius: 6, border: `1px solid ${cockpitColors.panelBorder}` }}
              />
              {integration.id === "highlevel" ? (
                <input
                  placeholder="Location ID"
                  value={crmForm.locationId}
                  onChange={(e) => setCrmForm((s) => ({ ...s, locationId: e.target.value }))}
                  style={{ padding: 8, borderRadius: 6, border: `1px solid ${cockpitColors.panelBorder}` }}
                />
              ) : null}
            </div>
          ) : canConnect && setupMode === "api_key" && integration.id === "sms_channel" ? (
            <div style={{ display: "flex", flexDirection: "column", gap: spacing.sm }}>
              {!smsAdvanced ? (
                <>
                  <div style={{ fontWeight: 600, fontSize: typography.caption.fontSize, color: cockpitColors.textPrimary }}>
                    A2P business + messaging details
                  </div>
                  <p style={{ margin: 0, fontSize: 12, color: cockpitColors.textMuted, lineHeight: 1.45 }}>
                    Needed for US texting approval. Use your exact legal business name.
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
                    Your business privacy policy URL
                    <span style={fieldHintStyle}>Required for carrier A2P — use this business&apos;s policy, not VIBETech&apos;s</span>
                    <input
                      placeholder="https://yourbusiness.com/privacy"
                      value={smsBrand.privacyPolicyUrl}
                      onChange={(e) => setSmsBrand((s) => ({ ...s, privacyPolicyUrl: e.target.value }))}
                      style={fieldInputStyle}
                    />
                  </label>
                  <label style={fieldLabelStyle}>
                    Your business terms URL
                    <span style={fieldHintStyle}>This business&apos;s terms of service / messaging terms</span>
                    <input
                      placeholder="https://yourbusiness.com/terms"
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
                      gap: 10,
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
                      <SmsProvisioningStatus
                        stage={resolveSmsProvisioningStage({
                          loading,
                          fromNumber: provisionResult.fromNumber ?? null,
                          a2pRegistrationStatus: provisionResult.a2pRegistrationStatus ?? null,
                        })}
                        fromNumber={provisionResult.fromNumber ?? null}
                        inboundWebhookConfigured={provisionResult.inboundWebhookConfigured ?? null}
                      />
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
              {voiceConnectResult ? (
                <>
                  <div style={{ fontWeight: 700, fontSize: 14, color: cockpitColors.textPrimary }}>
                    Phone connected
                  </div>
                  <p style={{ margin: 0, fontSize: 13, color: cockpitColors.textSecondary, lineHeight: 1.5 }}>
                    Business number: <strong>{voiceConnectResult.fromNumber || "saved"}</strong>
                    {voiceConnectResult.missedCallFollowUp?.active
                      ? ` · Missed calls ring ${voiceConnectResult.missedCallFollowUp.forwardNumber}, then text automatically.`
                      : " · Add a forward number anytime to enable missed-call texts."}
                  </p>
                  <ol style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: cockpitColors.textMuted, lineHeight: 1.55 }}>
                    {(voiceConnectResult.nextSteps ?? []).map((step) => (
                      <li key={step} style={{ marginBottom: 6 }}>{step}</li>
                    ))}
                  </ol>
                  <PrimaryButton onClick={finishConnected}>Done</PrimaryButton>
                </>
              ) : (
                <>
                  <div style={{ fontWeight: 700, fontSize: 14, color: cockpitColors.textPrimary }}>
                    Missed-call texts (4 steps)
                  </div>
                  <ol style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: cockpitColors.textMuted, lineHeight: 1.55 }}>
                    <li>Have a Twilio number (buy one, or reuse your SMS number if it supports Voice).</li>
                    <li>Paste Account SID, Auth Token, and that Twilio number below.</li>
                    <li>Enter your cell as “Forward to” so we ring you first.</li>
                    <li>After connect: publish the Twilio number as your business line, or forward unanswered calls from your existing business number to it.</li>
                  </ol>
                  <p style={{ margin: 0, fontSize: 12, color: cockpitColors.textMuted, lineHeight: 1.45 }}>
                    Twilio Console → account menu (top-left) → <strong>Account info</strong> for SID + Auth Token.
                    Phone Numbers → Active numbers for the +1 From number.
                  </p>
                  <label style={fieldLabelStyle}>
                    Account SID
                    <span style={fieldHintStyle}>Starts with AC…</span>
                    <input
                      placeholder="ACxxxxxxxx"
                      value={apiKeyForm.accountSid}
                      onChange={(e) => setApiKeyForm((s) => ({ ...s, accountSid: e.target.value }))}
                      style={fieldInputStyle}
                    />
                  </label>
                  <label style={fieldLabelStyle}>
                    Auth Token
                    <span style={fieldHintStyle}>Click Show, then copy</span>
                    <input
                      placeholder="Auth Token"
                      type="password"
                      value={apiKeyForm.authToken}
                      onChange={(e) => setApiKeyForm((s) => ({ ...s, authToken: e.target.value }))}
                      style={fieldInputStyle}
                    />
                  </label>
                  <label style={fieldLabelStyle}>
                    Twilio business number
                    <span style={fieldHintStyle}>The number callers dial (or get forwarded to)</span>
                    <input
                      placeholder="+1…"
                      value={apiKeyForm.fromNumber}
                      onChange={(e) => setApiKeyForm((s) => ({ ...s, fromNumber: e.target.value }))}
                      style={fieldInputStyle}
                    />
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 650 }}>
                    <input
                      type="checkbox"
                      checked={apiKeyForm.missedCallFollowUpEnabled}
                      onChange={(e) => setApiKeyForm((s) => ({ ...s, missedCallFollowUpEnabled: e.target.checked }))}
                    />
                    Ring my phone first, then text if I miss it (recommended)
                  </label>
                  {apiKeyForm.missedCallFollowUpEnabled ? (
                    <>
                      <label style={fieldLabelStyle}>
                        Your cell (forward / ring)
                        <span style={fieldHintStyle}>Required for missed-call texts</span>
                        <input
                          placeholder="+1…"
                          value={apiKeyForm.forwardNumber}
                          onChange={(e) => setApiKeyForm((s) => ({ ...s, forwardNumber: e.target.value }))}
                          style={fieldInputStyle}
                        />
                      </label>
                      <label style={fieldLabelStyle}>
                        Ring timeout (seconds)
                        <span style={fieldHintStyle}>How long we ring you before texting the caller</span>
                        <input
                          placeholder="20"
                          value={apiKeyForm.ringTimeoutSeconds}
                          onChange={(e) => setApiKeyForm((s) => ({ ...s, ringTimeoutSeconds: e.target.value }))}
                          style={fieldInputStyle}
                        />
                      </label>
                    </>
                  ) : (
                    <p style={{ margin: 0, fontSize: 12, color: cockpitColors.textMuted }}>
                      With this off, inbound calls use the AI receptionist instead of ringing your cell.
                    </p>
                  )}
                </>
              )}
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
          ) : canConnect && setupMode === "api_key" && integration.id === "prospecting_enrichment" ? (
            <div style={{ display: "flex", flexDirection: "column", gap: spacing.sm }}>
              <div style={{ fontWeight: 600, fontSize: typography.caption.fontSize, color: cockpitColors.textPrimary }}>
                Prospecting enrichment keys
              </div>
              <p style={{ margin: 0, fontSize: 12, color: cockpitColors.textMuted, lineHeight: 1.45 }}>
                Optional. Company discovery uses platform Serper. Enrichment verifies emails when Apollo or Hunter is connected.
                Without keys, Find leads still runs with public research and unverified pattern guesses.
              </p>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 650 }}>
                <input
                  type="checkbox"
                  checked={apiKeyForm.usePlatformKeys}
                  onChange={(e) => setApiKeyForm((s) => ({ ...s, usePlatformKeys: e.target.checked }))}
                />
                Use platform keys (APOLLO_API_KEY or HUNTER_API_KEY)
              </label>
              {!apiKeyForm.usePlatformKeys ? (
                <>
                  <label style={fieldLabelStyle}>
                    Apollo API key
                    <input
                      placeholder="Apollo key (optional if Hunter set)"
                      type="password"
                      value={apiKeyForm.apolloApiKey}
                      onChange={(e) => setApiKeyForm((s) => ({ ...s, apolloApiKey: e.target.value }))}
                      style={fieldInputStyle}
                    />
                  </label>
                  <label style={fieldLabelStyle}>
                    Hunter API key
                    <input
                      placeholder="Hunter key (optional if Apollo set)"
                      type="password"
                      value={apiKeyForm.hunterApiKey}
                      onChange={(e) => setApiKeyForm((s) => ({ ...s, hunterApiKey: e.target.value }))}
                      style={fieldInputStyle}
                    />
                  </label>
                </>
              ) : null}
            </div>
          ) : canConnect && integration.id === "meta_lead_ads" ? (
            <div style={{ display: "flex", flexDirection: "column", gap: spacing.sm }}>
              {metaRequestResult ? (
                <div style={{
                  display: "grid",
                  gap: 10,
                  padding: 12,
                  borderRadius: 12,
                  border: "1px solid #a7f3d0",
                  background: "#ecfdf5",
                }}>
                  <div style={{ fontWeight: 800, color: "#047857" }}>
                    Setup requested
                  </div>
                  <p style={{ margin: 0, fontSize: 13, color: "#065f46", lineHeight: 1.5, fontWeight: 600 }}>
                    {metaRequestResult.message
                      || "Our team is on it — we’ll create your Facebook Page ASAP (usually less than 24 hours)."}
                  </p>
                  <p style={{ margin: 0, fontSize: 12, color: "#047857", lineHeight: 1.45 }}>
                    You don’t need to do anything else. We’ll email you when Lead Ads are connected.
                  </p>
                  <PrimaryButton onClick={onClose}>Done</PrimaryButton>
                </div>
              ) : (
                <>
                  <div style={{ fontWeight: 700, fontSize: 14, color: cockpitColors.textPrimary }}>
                    VIBETech connects this for you
                  </div>
                  <div style={{
                    fontSize: 13,
                    lineHeight: 1.5,
                    padding: 10,
                    borderRadius: 10,
                    border: `1px solid ${cockpitColors.panelBorder}`,
                    background: "#fafaf9",
                    color: cockpitColors.inkOnLight,
                  }}>
                    <p style={{ margin: 0, color: cockpitColors.inkOnLight }}>
                      Most businesses already have a Facebook Page — put the name below. If you don’t have one yet, say so and we’ll help.
                    </p>
                    <p style={{ margin: "10px 0 0", color: cockpitColors.inkMutedOnLight }}>
                      After setup, new leads land in People for your team to follow up.
                    </p>
                  </div>
                  <div style={{ display: "grid", gap: 8 }}>
                    <label style={{
                      ...fieldLabelStyle,
                      display: "flex",
                      flexDirection: "row",
                      alignItems: "flex-start",
                      gap: 10,
                      padding: 10,
                      borderRadius: 10,
                      border: `1px solid ${metaForm.startingPoint === "have_page" ? cockpitColors.accent : cockpitColors.panelBorder}`,
                      background: metaForm.startingPoint === "have_page" ? cockpitColors.accentMuted : cockpitColors.panel,
                      cursor: "pointer",
                      color: cockpitColors.textPrimary,
                    }}>
                      <input
                        type="radio"
                        name="meta-starting-point"
                        checked={metaForm.startingPoint === "have_page"}
                        onChange={() => setMetaForm((s) => ({ ...s, startingPoint: "have_page" }))}
                        style={{ marginTop: 3 }}
                      />
                      <span>
                        <strong style={{ color: cockpitColors.textPrimary }}>We have a Facebook Page</strong>
                        <span style={{ display: "block", ...fieldHintStyle, marginTop: 2 }}>
                          Most clients — just the Page name is enough
                        </span>
                      </span>
                    </label>
                    <label style={{
                      ...fieldLabelStyle,
                      display: "flex",
                      flexDirection: "row",
                      alignItems: "flex-start",
                      gap: 10,
                      padding: 10,
                      borderRadius: 10,
                      border: `1px solid ${metaForm.startingPoint === "need_everything" ? cockpitColors.accent : cockpitColors.panelBorder}`,
                      background: metaForm.startingPoint === "need_everything" ? cockpitColors.accentMuted : cockpitColors.panel,
                      cursor: "pointer",
                      color: cockpitColors.textPrimary,
                    }}>
                      <input
                        type="radio"
                        name="meta-starting-point"
                        checked={metaForm.startingPoint === "need_everything"}
                        onChange={() => setMetaForm((s) => ({ ...s, startingPoint: "need_everything" }))}
                        style={{ marginTop: 3 }}
                      />
                      <span>
                        <strong style={{ color: cockpitColors.textPrimary }}>We don’t have Facebook / Lead Ads yet</strong>
                        <span style={{ display: "block", ...fieldHintStyle, marginTop: 2 }}>
                          We’ll help create the Page + first Lead form, then connect it
                        </span>
                      </span>
                    </label>
                  </div>
                  {metaForm.startingPoint === "have_page" ? (
                    <>
                      <label style={fieldLabelStyle}>
                        Facebook Page name
                        <span style={fieldHintStyle}>Usually the business name — e.g. Mind and Mobility</span>
                        <input
                          placeholder="Page name"
                          value={metaForm.pageName}
                          onChange={(e) => setMetaForm((s) => ({ ...s, pageName: e.target.value }))}
                          style={fieldInputStyle}
                        />
                      </label>
                      <label style={fieldLabelStyle}>
                        Facebook Page URL
                        <span style={fieldHintStyle}>Optional — facebook.com/…</span>
                        <input
                          placeholder="https://facebook.com/your-page"
                          value={metaForm.pageUrl}
                          onChange={(e) => setMetaForm((s) => ({ ...s, pageUrl: e.target.value }))}
                          style={fieldInputStyle}
                        />
                      </label>
                    </>
                  ) : (
                    <p style={{ margin: 0, fontSize: 13, color: cockpitColors.textSecondary, lineHeight: 1.45 }}>
                      No Page name needed. Hit request and we’ll email ops to build Facebook + Lead Ads with you from scratch.
                    </p>
                  )}
                  <label style={fieldLabelStyle}>
                    Anything else we should know?
                    <textarea
                      placeholder={
                        metaForm.startingPoint === "need_everything"
                          ? "Who should own the Facebook login, website/privacy policy URL, target area, etc."
                          : "Who manages ads, privacy policy URL, etc."
                      }
                      value={metaForm.notes}
                      onChange={(e) => setMetaForm((s) => ({ ...s, notes: e.target.value }))}
                      rows={3}
                      style={{ ...fieldInputStyle, resize: "vertical" as const }}
                    />
                  </label>
                </>
              )}
            </div>
          ) : canConnect ? (
            <>
              <div style={{ fontWeight: 700, fontSize: 15, color: cockpitColors.textPrimary }}>
                {isBusinessEmail ? "Use the inbox you write customers from" : integration.title}
              </div>
              <p style={{ ...typography.caption, color: cockpitColors.textSecondary, margin: `${spacing.xs} 0 0`, lineHeight: 1.45 }}>
                {isBusinessEmail
                  ? "Nothing sends without your OK."
                  : integration.id === "calendar"
                  ? "Events stay on your Google Calendar."
                  : setupMode === "oauth"
                  ? "Sign in with Google to connect."
                  : "Connect this tool."}
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
