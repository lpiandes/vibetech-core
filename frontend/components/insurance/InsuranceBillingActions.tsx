"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function InsuranceBillingActions({
  businessId,
  hasCustomer,
}: {
  businessId: string;
  hasCustomer: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function pay() {
    setBusy(true);
    setError(null);
    try {
      const method = hasCustomer ? "PUT" : "POST";
      const res = await fetch("/api/insurance/billing", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.url) {
        if (hasCustomer && res.status === 503) {
          const checkout = await fetch("/api/insurance/billing", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ businessId }),
          });
          const next = await checkout.json().catch(() => ({}));
          if (checkout.ok && next.url) {
            window.location.assign(next.url);
            return;
          }
        }
        setError(String(data.error || "Could not open payment."));
        setBusy(false);
        return;
      }
      window.location.assign(data.url);
    } catch {
      setError("Could not open payment.");
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {error ? <p style={{ color: "#fca5a5", margin: 0 }}>{error}</p> : null}
      <Button type="button" onClick={pay} disabled={busy} size="lg" className="w-full h-11 font-semibold">
        {busy ? "Opening Stripe…" : hasCustomer ? "Catch up on payment" : "Pay $200/month"}
      </Button>
    </div>
  );
}
