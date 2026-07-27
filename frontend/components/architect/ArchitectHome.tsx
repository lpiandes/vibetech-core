"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { architect } from "./architectTheme";
import {
  ArchitectButton,
  ArchitectPanel,
  ArchitectShell,
} from "./ArchitectPrimitives";
import { presentProductError, type ProductErrorView } from "@/lib/platform/productErrors";
import ProductErrorBanner from "@/components/product/ProductErrorBanner";

/**
 * Brand-first Architect home — hire the consultant, one conversation opener.
 */
export default function ArchitectHome() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const businessIdParam = searchParams.get("businessId");
  const [busy, setBusy] = useState(false);
  const [description, setDescription] = useState("");
  const [error, setError] = useState<ProductErrorView | null>(null);

  async function start(seed?: string) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/builder/sessions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          mode: businessIdParam ? "configure_existing_business" : "new_business",
          businessId: businessIdParam || undefined,
          description: seed || description || null,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) {
        setError(data.productError ?? presentProductError(data.error ?? data.reason ?? "session_create_failed"));
        return;
      }
      router.push(`/architect/${data.session.sessionId}`);
    } catch (err) {
      setError(presentProductError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ArchitectShell maxWidth={680}>
      <div style={{ minHeight: "68vh", display: "grid", alignContent: "center" }}>
        <ArchitectPanel style={{ display: "grid", gap: 16 }}>
          <h2 style={{ margin: 0, fontSize: 22 }}>Tell Architect about your business</h2>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Tell us what your business does, who it serves, and the work you want help with…"
            rows={7}
            style={{
              width: "100%",
              resize: "vertical",
              borderRadius: architect.radiusSm,
              border: `1px solid ${architect.border}`,
              background: "rgba(2,6,23,.45)",
              color: architect.ink,
              padding: 16,
              fontSize: 16,
              lineHeight: 1.5,
              fontFamily: architect.font,
            }}
          />
          {error ? <ProductErrorBanner error={error} onRetry={() => void start()} /> : null}
          <ArchitectButton disabled={busy} onClick={() => void start()}>
            {busy ? "Opening Architect…" : "Begin the conversation"}
          </ArchitectButton>
        </ArchitectPanel>
      </div>
    </ArchitectShell>
  );
}
