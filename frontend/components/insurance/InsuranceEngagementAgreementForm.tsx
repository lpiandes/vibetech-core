"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { insuranceFieldStyle, insuranceLabelStyle } from "./insuranceFormStyles";

export function InsuranceEngagementAgreementForm({
  businessId,
  agreementHtml,
  expectedSigner,
}: {
  businessId: string;
  agreementHtml: string;
  expectedSigner: string;
}) {
  const [signedName, setSignedName] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!agreed) {
      setError("Check I agree to continue.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/insurance/${encodeURIComponent(businessId)}/onboarding`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step: "agreement", signedName }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(String(data.error || "Could not save the agreement."));
        setBusy(false);
        return;
      }
      window.location.assign(data.next || `/insurance/${encodeURIComponent(businessId)}`);
    } catch {
      setError("Could not save. Try again.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} style={{ display: "grid", gap: 14 }}>
      <div
        style={{
          padding: 0,
          borderRadius: 16,
          border: "none",
          background: "transparent",
          fontSize: 14,
        }}
        dangerouslySetInnerHTML={{ __html: agreementHtml }}
      />
      <label style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 14 }}>
        <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
        <span>I agree to this engagement agreement on behalf of the business.</span>
      </label>
      <label>
        <span style={insuranceLabelStyle}>Type the owner’s name to sign{expectedSigner ? ` (e.g. ${expectedSigner})` : ""}</span>
        <input
          required
          value={signedName}
          onChange={(e) => setSignedName(e.target.value)}
          style={insuranceFieldStyle}
          autoComplete="name"
        />
      </label>
      {error ? <p style={{ color: "#fca5a5", margin: 0, fontSize: 14 }}>{error}</p> : null}
      <p style={{ margin: 0, fontSize: 14, opacity: 0.9 }}>
        The business name and address at the top came from the details you just entered. Typing your name below is the signature.
      </p>
      <Button type="submit" disabled={busy} size="lg" className="w-full h-11 font-semibold">
        {busy ? "Signing…" : "Sign and open dashboard"}
      </Button>
    </form>
  );
}
