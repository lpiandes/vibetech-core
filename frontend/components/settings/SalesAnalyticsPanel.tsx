"use client";

import { useEffect, useState } from "react";
import { cockpitColors } from "@/design/tokens";
import SecondaryButton from "@/components/product/SecondaryButton";

/**
 * Sales Analytics Dashboard + Reporting Automation surface — composed live
 * from CRM pipeline state and Outcomes evidence, with an owner digest
 * schedule and an honest "present now" action (no fabricated send history).
 */
export default function SalesAnalyticsPanel({ businessId }: { businessId: string }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [analytics, setAnalytics] = useState<any>(null);
  const [schedule, setSchedule] = useState<any>(null);
  const [presenting, setPresenting] = useState(false);
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [digest, setDigest] = useState<any>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/businesses/${encodeURIComponent(businessId)}/sales-analytics`);
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data.ok === false) {
          throw new Error(data.error ?? "Could not load sales analytics.");
        }
        if (!cancelled) {
          setAnalytics(data.analytics ?? null);
          setSchedule(data.digestSchedule ?? null);
        }
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

  async function toggleDigest(enabled: boolean) {
    setSavingSchedule(true);
    try {
      const res = await fetch(`/api/businesses/${encodeURIComponent(businessId)}/sales-analytics`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "schedule_digest", enabled }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok !== false) setSchedule(data.schedule ?? null);
    } finally {
      setSavingSchedule(false);
    }
  }

  async function presentNow() {
    setPresenting(true);
    try {
      const res = await fetch(`/api/businesses/${encodeURIComponent(businessId)}/sales-analytics`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "present_now" }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok !== false) {
        setDigest(data.digest ?? null);
        setSchedule(data.schedule ?? null);
      }
    } finally {
      setPresenting(false);
    }
  }

  return (
    <section style={{ display: "grid", gap: 12 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: cockpitColors.textMuted }}>Sales analytics & reporting</div>

      {loading ? (
        <p style={{ margin: 0, color: cockpitColors.textSecondary, fontSize: 14 }}>Loading…</p>
      ) : error ? (
        <p style={{ margin: 0, color: cockpitColors.critical, fontSize: 14 }}>{error}</p>
      ) : (
        <>
          {analytics ? (
            <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 4, fontSize: 13, color: cockpitColors.textSecondary }}>
              <li>Contacts: {analytics.pipeline?.totalContacts ?? 0}</li>
              <li>Open opportunities: {analytics.pipeline?.openCards ?? 0} (value {analytics.pipeline?.openValue ?? 0})</li>
              <li>Won / Lost: {analytics.pipeline?.wonCards ?? 0} / {analytics.pipeline?.lostCards ?? 0}</li>
              <li>Proof-backed completions: {analytics.outcomes?.proofBackedCompleted ?? 0}</li>
            </ul>
          ) : null}
          {analytics?.honesty?.message ? (
            <p style={{ margin: 0, fontSize: 12, color: cockpitColors.textMuted, lineHeight: 1.45 }}>
              {analytics.honesty.message}
            </p>
          ) : null}

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: cockpitColors.textPrimary }}>
              <input
                type="checkbox"
                checked={Boolean(schedule?.enabled)}
                disabled={savingSchedule}
                onChange={(e) => void toggleDigest(e.target.checked)}
              />
              Weekly owner digest
            </label>
            <SecondaryButton onClick={() => void presentNow()}>
              {presenting ? "Presenting…" : "Present now"}
            </SecondaryButton>
          </div>

          {digest ? (
            <div
              style={{
                padding: 12,
                borderRadius: 12,
                background: "rgba(15,23,42,.04)",
                border: `1px solid ${cockpitColors.panelBorder}`,
                display: "grid",
                gap: 6,
              }}
            >
              <div style={{ fontWeight: 750, fontSize: 14, color: cockpitColors.textPrimary }}>{digest.headline}</div>
              {digest.sections?.map((section: any) => (
                <div key={section.id} style={{ fontSize: 12, color: cockpitColors.textSecondary }}>
                  <strong>{section.label}:</strong>{" "}
                  {section.stats.map((s: any) => `${s.label} ${s.value}`).join(" · ")}
                </div>
              ))}
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
