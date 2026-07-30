"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import ShellPanel from "@/components/shell/ShellPanel";
import PrimaryButton from "@/components/product/PrimaryButton";
import StatusBadge from "@/components/product/StatusBadge";
import { cockpitColors, spacing, typography, radius } from "@/design/tokens";

export type AdsProviderTotals = {
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  leads?: number;
  cpl?: number | null;
};

export type AdsCampaign = {
  id: string;
  name: string;
  status: string | null;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  leads?: number;
  cpl?: number | null;
};

export type AdsProvider = {
  id: string;
  label: string;
  status: "connected" | "not_connected" | "not_configured" | "error";
  message?: string;
  totals: AdsProviderTotals;
  campaigns: AdsCampaign[];
};

export type AdsMetricsResponse = {
  dateRange: { since: string; until: string; days: number };
  providers: AdsProvider[];
};

function formatCurrency(n: number | null | undefined) {
  if (n === null || n === undefined) return "—";
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatNumber(n: number | null | undefined) {
  if (n === null || n === undefined) return "—";
  return n.toLocaleString();
}

function formatPercent(n: number | null | undefined) {
  if (n === null || n === undefined) return "—";
  return `${n.toFixed(2)}%`;
}

function statusTone(status: AdsProvider["status"]): "success" | "neutral" | "warning" {
  if (status === "connected") return "success";
  if (status === "error") return "warning";
  return "neutral";
}

function statusLabel(status: AdsProvider["status"]) {
  if (status === "connected") return "Connected";
  if (status === "not_configured") return "Not configured";
  if (status === "error") return "Error";
  return "Not connected";
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        borderRadius: radius.medium,
        border: `1px solid ${cockpitColors.panelBorder}`,
        background: cockpitColors.panel,
        padding: spacing.md,
        minWidth: 0,
      }}
    >
      <div style={{ fontSize: typography.caption.fontSize, color: cockpitColors.textMuted, fontWeight: 650 }}>
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 800, color: cockpitColors.textPrimary, marginTop: 4 }}>{value}</div>
    </div>
  );
}

function ProviderEmptyState({ provider, businessId }: { provider: AdsProvider; businessId: string }) {
  const isNotConfigured = provider.status === "not_configured";
  return (
    <div
      style={{
        padding: spacing.lg,
        display: "grid",
        gap: 6,
        color: cockpitColors.textMuted,
        fontSize: typography.caption.fontSize,
      }}
    >
      <div style={{ color: cockpitColors.textSecondary, fontWeight: 650 }}>
        {isNotConfigured ? `${provider.label} reporting isn't available yet.` : `${provider.label} isn't connected.`}
      </div>
      <div>
        {provider.message
          ?? `Connect ${provider.label} in Integrations to see spend, impressions, clicks, and campaigns here.`}
      </div>
      {!isNotConfigured ? (
        <div style={{ marginTop: 6 }}>
          <Link
            href={`/b/${encodeURIComponent(businessId)}/integrations`}
            style={{ color: cockpitColors.accent, fontWeight: 700, textDecoration: "none" }}
          >
            Connect {provider.label} in Integrations →
          </Link>
        </div>
      ) : null}
    </div>
  );
}

function CampaignTable({ campaigns, hasLeads }: { campaigns: AdsCampaign[]; hasLeads: boolean }) {
  if (!campaigns.length) {
    return (
      <div style={{ padding: spacing.md, color: cockpitColors.textMuted, fontSize: typography.caption.fontSize }}>
        No campaigns reported for this date range.
      </div>
    );
  }
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: typography.caption.fontSize }}>
        <thead>
          <tr style={{ borderBottom: `1px solid ${cockpitColors.panelBorder}`, textAlign: "left" }}>
            <th style={{ padding: `${spacing.sm} ${spacing.md}`, color: cockpitColors.textMuted, fontWeight: 700 }}>Campaign</th>
            <th style={{ padding: `${spacing.sm} ${spacing.md}`, color: cockpitColors.textMuted, fontWeight: 700 }}>Status</th>
            <th style={{ padding: `${spacing.sm} ${spacing.md}`, color: cockpitColors.textMuted, fontWeight: 700, textAlign: "right" }}>Spend</th>
            <th style={{ padding: `${spacing.sm} ${spacing.md}`, color: cockpitColors.textMuted, fontWeight: 700, textAlign: "right" }}>Impressions</th>
            <th style={{ padding: `${spacing.sm} ${spacing.md}`, color: cockpitColors.textMuted, fontWeight: 700, textAlign: "right" }}>Clicks</th>
            <th style={{ padding: `${spacing.sm} ${spacing.md}`, color: cockpitColors.textMuted, fontWeight: 700, textAlign: "right" }}>CTR</th>
            {hasLeads ? (
              <>
                <th style={{ padding: `${spacing.sm} ${spacing.md}`, color: cockpitColors.textMuted, fontWeight: 700, textAlign: "right" }}>Leads</th>
                <th style={{ padding: `${spacing.sm} ${spacing.md}`, color: cockpitColors.textMuted, fontWeight: 700, textAlign: "right" }}>CPL</th>
              </>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {campaigns.map((c) => (
            <tr key={c.id} style={{ borderBottom: `1px solid ${cockpitColors.panelBorder}` }}>
              <td style={{ padding: `${spacing.sm} ${spacing.md}`, color: cockpitColors.textPrimary, fontWeight: 650 }}>{c.name}</td>
              <td style={{ padding: `${spacing.sm} ${spacing.md}`, color: cockpitColors.textMuted }}>{c.status ?? "—"}</td>
              <td style={{ padding: `${spacing.sm} ${spacing.md}`, textAlign: "right", color: cockpitColors.textPrimary }}>{formatCurrency(c.spend)}</td>
              <td style={{ padding: `${spacing.sm} ${spacing.md}`, textAlign: "right", color: cockpitColors.textPrimary }}>{formatNumber(c.impressions)}</td>
              <td style={{ padding: `${spacing.sm} ${spacing.md}`, textAlign: "right", color: cockpitColors.textPrimary }}>{formatNumber(c.clicks)}</td>
              <td style={{ padding: `${spacing.sm} ${spacing.md}`, textAlign: "right", color: cockpitColors.textPrimary }}>{formatPercent(c.ctr)}</td>
              {hasLeads ? (
                <>
                  <td style={{ padding: `${spacing.sm} ${spacing.md}`, textAlign: "right", color: cockpitColors.textPrimary }}>{formatNumber(c.leads)}</td>
                  <td style={{ padding: `${spacing.sm} ${spacing.md}`, textAlign: "right", color: cockpitColors.textPrimary }}>{formatCurrency(c.cpl)}</td>
                </>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ProviderSection({ provider, businessId }: { provider: AdsProvider; businessId: string }) {
  const hasLeads = provider.campaigns.some((c) => typeof c.leads === "number");
  return (
    <ShellPanel
      title={provider.label}
      subtitle={`${provider.campaigns.length} campaign${provider.campaigns.length === 1 ? "" : "s"} in range`}
      action={<StatusBadge label={statusLabel(provider.status)} tone={statusTone(provider.status)} />}
    >
      {provider.status === "connected" ? (
        <div style={{ display: "grid", gap: spacing.sm }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: hasLeads ? "repeat(6, 1fr)" : "repeat(4, 1fr)",
              gap: spacing.sm,
              padding: spacing.md,
            }}
          >
            <SummaryCard label="Spend" value={formatCurrency(provider.totals.spend)} />
            <SummaryCard label="Impressions" value={formatNumber(provider.totals.impressions)} />
            <SummaryCard label="Clicks" value={formatNumber(provider.totals.clicks)} />
            <SummaryCard label="CTR" value={formatPercent(provider.totals.ctr)} />
            {hasLeads ? (
              <>
                <SummaryCard label="Leads" value={formatNumber(provider.totals.leads)} />
                <SummaryCard label="CPL" value={formatCurrency(provider.totals.cpl)} />
              </>
            ) : null}
          </div>
          <CampaignTable campaigns={provider.campaigns} hasLeads={hasLeads} />
        </div>
      ) : (
        <ProviderEmptyState provider={provider} businessId={businessId} />
      )}
    </ShellPanel>
  );
}

export default function AdsMetricsDashboard({
  businessId,
  initialData,
}: {
  businessId: string;
  initialData: AdsMetricsResponse;
}) {
  const [days, setDays] = useState<7 | 30>(initialData.dateRange.days === 7 ? 7 : 30);
  const [data, setData] = useState<AdsMetricsResponse>(initialData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (days === initialData.dateRange.days) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/businesses/${encodeURIComponent(businessId)}/ads/metrics?days=${days}`);
        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json.ok) {
          if (!cancelled) setError(json?.error ?? "Could not load ad performance.");
          return;
        }
        if (!cancelled) setData(json);
      } catch {
        if (!cancelled) setError("Could not load ad performance (network error).");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days, businessId]);

  const connectedProviders = data.providers.filter((p) => p.status === "connected");
  const anyConnected = connectedProviders.length > 0;

  const combinedTotals = connectedProviders.reduce(
    (acc, p) => {
      acc.spend += p.totals.spend;
      acc.impressions += p.totals.impressions;
      acc.clicks += p.totals.clicks;
      if (typeof p.totals.leads === "number") acc.leads = (acc.leads ?? 0) + p.totals.leads;
      return acc;
    },
    { spend: 0, impressions: 0, clicks: 0 } as { spend: number; impressions: number; clicks: number; leads?: number },
  );
  const combinedCtr = combinedTotals.impressions > 0 ? (combinedTotals.clicks / combinedTotals.impressions) * 100 : 0;
  const combinedCpl =
    typeof combinedTotals.leads === "number" && combinedTotals.leads > 0
      ? combinedTotals.spend / combinedTotals.leads
      : null;

  return (
    <div style={{ display: "grid", gap: spacing.md }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: spacing.sm }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800, color: cockpitColors.textPrimary }}>Ad performance</div>
          <div style={{ fontSize: typography.caption.fontSize, color: cockpitColors.textMuted, marginTop: 2 }}>
            {data.dateRange.since} → {data.dateRange.until}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {([7, 30] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setDays(option)}
              disabled={loading}
              style={{
                borderRadius: radius.medium,
                border: `1px solid ${days === option ? cockpitColors.accent : cockpitColors.panelBorder}`,
                background: days === option ? cockpitColors.accentMuted : cockpitColors.panel,
                color: days === option ? cockpitColors.accent : cockpitColors.textSecondary,
                fontWeight: 700,
                fontSize: 13,
                padding: "8px 14px",
                cursor: loading ? "wait" : "pointer",
              }}
            >
              {option} days
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <div style={{ padding: spacing.md, color: "#b91c1c", fontSize: typography.caption.fontSize }}>{error}</div>
      ) : null}

      {anyConnected ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: typeof combinedTotals.leads === "number" ? "repeat(6, 1fr)" : "repeat(4, 1fr)",
            gap: spacing.sm,
          }}
        >
          <SummaryCard label="Spend" value={formatCurrency(combinedTotals.spend)} />
          <SummaryCard label="Impressions" value={formatNumber(combinedTotals.impressions)} />
          <SummaryCard label="Clicks" value={formatNumber(combinedTotals.clicks)} />
          <SummaryCard label="CTR" value={formatPercent(combinedCtr)} />
          {typeof combinedTotals.leads === "number" ? (
            <>
              <SummaryCard label="Leads" value={formatNumber(combinedTotals.leads)} />
              <SummaryCard label="CPL" value={formatCurrency(combinedCpl)} />
            </>
          ) : null}
        </div>
      ) : (
        <ShellPanel title="No ads connected yet" subtitle="Connect Meta Ads, Google Ads, or TikTok to see live performance here.">
          <div style={{ padding: spacing.lg }}>
            <PrimaryButton href={`/b/${encodeURIComponent(businessId)}/integrations`}>
              Go to Integrations
            </PrimaryButton>
          </div>
        </ShellPanel>
      )}

      <div style={{ display: "grid", gap: spacing.md }}>
        {data.providers.map((provider) => (
          <ProviderSection key={provider.id} provider={provider} businessId={businessId} />
        ))}
      </div>
    </div>
  );
}
