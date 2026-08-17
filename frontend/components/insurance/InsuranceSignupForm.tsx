"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { insuranceFieldStyle, insuranceLabelStyle } from "./insuranceFormStyles";
import { authenticateInsuranceCredentials } from "@/lib/insurance/signInToInsurance";
import { insuranceSignInHref } from "@/lib/platform/routeProtection";

export function InsuranceSignupForm() {
  const [name, setName] = useState("");
  const [agencyName, setAgencyName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [promoCode, setPromoCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/insurance/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, agencyName, email, password, promoCode }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(String(data.error || "Could not create account."));
        setBusy(false);
        return;
      }
      const nextPath = String(
        data.nextPath
        || `/insurance/billing?businessId=${encodeURIComponent(String(data.businessId || ""))}`,
      );
      const signed = await authenticateInsuranceCredentials({ email, password, nextPath });
      if (!signed.ok) {
        window.location.assign(insuranceSignInHref(nextPath));
        return;
      }
      window.location.assign(String(data.checkoutUrl || nextPath));
    } catch {
      setError("Sign up failed. Try again.");
      setBusy(false);
    }
  }

  const hasPromo = Boolean(promoCode.trim());

  return (
    <form onSubmit={onSubmit} style={{ display: "grid", gap: 14 }}>
      <label>
        <span style={insuranceLabelStyle}>Your name</span>
        <input required value={name} onChange={(e) => setName(e.target.value)} style={insuranceFieldStyle} autoComplete="name" />
      </label>
      <label>
        <span style={insuranceLabelStyle}>Agency name</span>
        <input required value={agencyName} onChange={(e) => setAgencyName(e.target.value)} style={insuranceFieldStyle} autoComplete="organization" />
      </label>
      <label>
        <span style={insuranceLabelStyle}>Email</span>
        <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} style={insuranceFieldStyle} autoComplete="email" />
      </label>
      <label>
        <span style={insuranceLabelStyle}>Password (8+ characters)</span>
        <input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} style={insuranceFieldStyle} autoComplete="new-password" />
      </label>
      <label>
        <span style={insuranceLabelStyle}>Promo code (optional)</span>
        <input
          value={promoCode}
          onChange={(e) => setPromoCode(e.target.value)}
          style={insuranceFieldStyle}
          autoComplete="off"
          spellCheck={false}
        />
      </label>
      {error ? (
        <p style={{ color: "#fca5a5", margin: 0, fontSize: 14 }}>
          {error}{" "}
          {/already exists|log in/i.test(error) ? <Link href="/insurance">Log in</Link> : null}
        </p>
      ) : null}
      <Button type="submit" disabled={busy} size="lg" className="w-full h-11 font-semibold">
        {busy ? "Working…" : hasPromo ? "Create free account" : "Continue to payment · $200/month"}
      </Button>
    </form>
  );
}
