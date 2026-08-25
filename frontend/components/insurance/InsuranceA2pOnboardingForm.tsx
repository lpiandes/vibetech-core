"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { insuranceFieldStyle, insuranceLabelStyle } from "./insuranceFormStyles";
import {
  FE_A2P_BUSINESS_TYPES,
  FE_A2P_INDUSTRIES,
  FE_A2P_JOB_POSITIONS,
  VIBEKEEP_DEFAULT_PRIVACY_URL,
  VIBEKEEP_DEFAULT_TERMS_URL,
  defaultFeA2pOptInMessage,
} from "../../../backend/core/fe-retention/FeRetentionOnboardingCatalog.js";

type Profile = Record<string, string>;

export function InsuranceA2pOnboardingForm({
  businessId,
  initial,
}: {
  businessId: string;
  initial: Profile;
}) {
  const [form, setForm] = useState<Profile>(() => ({
    ...initial,
    privacyPolicyUrl: initial.privacyPolicyUrl || VIBEKEEP_DEFAULT_PRIVACY_URL,
    termsUrl: initial.termsUrl || VIBEKEEP_DEFAULT_TERMS_URL,
    optInKeywords: initial.optInKeywords || "",
    optInMessage: initial.optInMessage || "",
  }));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function set(key: string, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/insurance/${encodeURIComponent(businessId)}/onboarding`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step: "profile", profile: form }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(String(data.error || "Could not save business details."));
        setBusy(false);
        return;
      }
      window.location.assign(`/insurance/setup/${encodeURIComponent(businessId)}/agreement`);
    } catch {
      setError("Could not save. Try again.");
      setBusy(false);
    }
  }

  const hint = (text: string) => (
    <p style={{ margin: "-4px 0 0", fontSize: 12, opacity: 0.75, lineHeight: 1.4 }}>{text}</p>
  );

  const field = (
    key: string,
    label: string,
    extra: React.InputHTMLAttributes<HTMLInputElement> = {},
  ) => (
    <label>
      <span style={insuranceLabelStyle}>{label}</span>
      <input
        required
        value={form[key] || ""}
        onChange={(e) => set(key, e.target.value)}
        style={insuranceFieldStyle}
        {...extra}
      />
    </label>
  );

  const select = (key: string, label: string, options: readonly string[]) => (
    <label>
      <span style={insuranceLabelStyle}>{label}</span>
      <select
        required
        value={form[key] || ""}
        onChange={(e) => set(key, e.target.value)}
        style={insuranceFieldStyle}
      >
        <option value="">Select…</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>{opt.replace(/_/g, " ")}</option>
        ))}
      </select>
    </label>
  );

  const sampleOptIn = defaultFeA2pOptInMessage(form.legalBusinessName || "your agency");

  return (
    <form onSubmit={onSubmit} style={{ display: "grid", gap: 12 }}>
      {field("legalBusinessName", "Legal business name (as on EIN letter)")}
      {select("businessType", "Business type", FE_A2P_BUSINESS_TYPES)}
      {field("ein", "EIN / tax ID", { inputMode: "numeric" })}
      {select("businessIndustry", "Business industry", FE_A2P_INDUSTRIES)}
      {field("websiteUrl", "Website URL", { placeholder: "https://youragency.com", inputMode: "url" })}
      {field("privacyPolicyUrl", "Privacy policy URL", {
        placeholder: VIBEKEEP_DEFAULT_PRIVACY_URL,
        inputMode: "url",
      })}
      {hint("Carriers require a live privacy page. Use yours, or keep the VibeTech default until you have one.")}
      {field("termsUrl", "Terms and conditions URL", {
        placeholder: VIBEKEEP_DEFAULT_TERMS_URL,
        inputMode: "url",
      })}
      {hint("Must mention message/data rates, frequency, HELP, and STOP. VibeTech terms work as a starting point.")}
      {field("street", "Street address")}
      {field("city", "City")}
      {field("region", "State")}
      {field("postalCode", "ZIP")}
      {field("notifyEmail", "Status notification email", { type: "email" })}
      {field("contactFirstName", "Authorized representative first name")}
      {field("contactLastName", "Last name")}
      {field("contactEmail", "Representative email", { type: "email" })}
      {field("businessTitle", "Business title")}
      {select("jobPosition", "Job position", FE_A2P_JOB_POSITIONS)}
      {field("contactPhone", "Phone", { type: "tel" })}
      {field("preferredAreaCode", "Preferred area code (e.g. 978)", { inputMode: "numeric", maxLength: 3, pattern: "[0-9]{3}" })}

      <div style={{ display: "grid", gap: 8, marginTop: 4 }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 700 }}>Text opt-in (Twilio campaign)</p>
        <label>
          <span style={insuranceLabelStyle}>Opt-in keywords (optional)</span>
          <input
            value={form.optInKeywords || ""}
            onChange={(e) => set("optInKeywords", e.target.value)}
            style={insuranceFieldStyle}
            placeholder="Leave blank for VibeKeep"
            maxLength={255}
          />
        </label>
        {hint("Leave blank. VibeKeep clients opt in when the agent adds their number with consent — not by texting START.")}
        <label>
          <span style={insuranceLabelStyle}>Opt-in message (only if you use keywords)</span>
          <textarea
            value={form.optInMessage || ""}
            onChange={(e) => set("optInMessage", e.target.value)}
            style={{ ...insuranceFieldStyle, minHeight: 88, resize: "vertical" }}
            placeholder={sampleOptIn}
            maxLength={320}
          />
        </label>
        {hint(
          form.optInKeywords
            ? "Required when keywords are set (20–320 characters). Include HELP and STOP."
            : `Leave blank unless you add keywords. If you ever enable START, use something like: ${sampleOptIn}`,
        )}
      </div>

      {error ? <p style={{ color: "#fca5a5", margin: 0, fontSize: 14 }}>{error}</p> : null}
      <Button type="submit" disabled={busy} size="lg" className="w-full h-11 font-semibold">
        {busy ? "Saving…" : "Continue to agreement"}
      </Button>
    </form>
  );
}
