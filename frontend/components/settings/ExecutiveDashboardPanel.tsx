"use client";

import { useEffect, useState } from "react";
import { cockpitColors } from "@/design/tokens";
import SalesAnalyticsPanel from "./SalesAnalyticsPanel";

/**
 * Executive Dashboard add-on surface — proof-backed sales + usage roll-up.
 */
export default function ExecutiveDashboardPanel({ businessId }: { businessId: string }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dash, setDash] = useState<any>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/businesses/${encodeURIComponent(businessId)}/executive-dashboard`);
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data.ok === false) {
          throw new Error(data.error ?? "Could not load executive dashboard.");
        }
        if (!cancelled) setDash(data.dashboard ?? null);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Load failed.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [businessId]);

  return (
    <section style={{ display: "grid", gap: 16 }}>
      <div>
        <h2 style={{ margin: 0, fontSize: 18, color: cockpitColors.textPrimary }}>Executive Dashboard</h2>
        <p style={{ margin: "6px 0 0", color: cockpitColors.textSecondary, fontSize: 13 }}>
          Proof-backed roll-up of pipeline, Decisions, and usage — not forecasts.
        </p>
      </div>

      {loading ? <p style={{ color: cockpitColors.textSecondary }}>Loading…</p> : null}
      {error ? <p style={{ color: cockpitColors.danger ?? "#b91c1c" }}>{error}</p> : null}

      {dash ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
            gap: 12,
          }}
        >
          <Stat label="Open Decisions" value={String(dash.openDecisions ?? 0)} />
          <Stat label="Emails (month)" value={String(dash.usage?.emails ?? 0)} />
          <Stat label="SMS segments" value={String(dash.usage?.smsSegments ?? 0)} />
          <Stat label="AI credits" value={String(dash.usage?.aiCredits ?? 0)} />
          <Stat
            label="Voice min in/out"
            value={`${dash.usage?.voiceMinutesInbound ?? 0} / ${dash.usage?.voiceMinutesOutbound ?? 0}`}
          />
        </div>
      ) : null}

      <SalesAnalyticsPanel businessId={businessId} />
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        padding: "12px 14px",
        border: `1px solid ${cockpitColors.border ?? "#e5e7eb"}`,
        borderRadius: 8,
        background: cockpitColors.surface ?? "#fff",
      }}
    >
      <div style={{ fontSize: 11, color: cockpitColors.textSecondary, textTransform: "uppercase" }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 600, marginTop: 4, color: cockpitColors.textPrimary }}>{value}</div>
    </div>
  );
}
