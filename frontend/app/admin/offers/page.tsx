"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { cockpitColors, spacing, typography, radius } from "@/design/tokens";

type OfferRow = {
  id: string;
  sheetSection: string;
  sheetLine: string;
  packageId: string | null;
  offerClass: string;
  deliveryPlaybookId: string;
  implementationStatus: string;
  setupPriceUsd: number | null;
  monthlyPriceUsd: number | null;
  notes?: string | null;
};

type Summary = {
  total: number;
  complete: number;
  building: number;
  byClass: Record<string, number>;
};

export default function AdminOffersPage() {
  const [offers, setOffers] = useState<OfferRow[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [gateResult, setGateResult] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/admin/commercial-offers");
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed to load offers");
        if (!cancelled) {
          setOffers(Array.isArray(data.offers) ? data.offers : []);
          setSummary(data.summary ?? null);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return offers;
    return offers.filter((row) =>
      [row.sheetLine, row.sheetSection, row.offerClass, row.packageId ?? "", row.deliveryPlaybookId]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [offers, query]);

  async function checkSell(sheetLine: string) {
    setGateResult(null);
    const res = await fetch(`/api/admin/commercial-offers?sheetLine=${encodeURIComponent(sheetLine)}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setGateResult(data.error ?? "Gate failed");
      return;
    }
    const gate = data.gate;
    setGateResult(
      gate?.allowed
        ? `ALLOWED · ${gate.offerClass} · playbook ${gate.playbookId}`
        : `BLOCKED · ${gate?.reason ?? "unknown"} · ${(gate?.blockers ?? []).join("; ")}`,
    );
  }

  return (
    <div style={{ display: "grid", gap: spacing.lg }}>
      <div>
        <h1 style={{ margin: 0, color: cockpitColors.textPrimary, fontSize: 28, fontWeight: 750 }}>
          Commercial Offer Matrix
        </h1>
        <p style={{ margin: `${spacing.sm} 0 0`, color: cockpitColors.textSecondary, maxWidth: 720 }}>
          Every pricing-sheet line maps to Ready, Custom Build, Consulting, Managed Ops, or Usage.
          Incomplete paths cannot be sold.
        </p>
      </div>

      {summary ? (
        <div style={{ display: "flex", gap: spacing.md, flexWrap: "wrap" }}>
          <Stat label="Total lines" value={summary.total} />
          <Stat label="Complete" value={summary.complete} />
          <Stat label="Building" value={summary.building} />
          {Object.entries(summary.byClass ?? {}).map(([k, v]) => (
            <Stat key={k} label={k} value={v} />
          ))}
        </div>
      ) : null}

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Filter sheet lines…"
        style={{
          height: 38,
          borderRadius: radius.medium,
          border: `1px solid ${cockpitColors.panelBorder}`,
          background: cockpitColors.panelElevated,
          color: cockpitColors.textPrimary,
          padding: `0 ${spacing.md}`,
        }}
      />

      {gateResult ? (
        <div style={{
          padding: spacing.md,
          borderRadius: radius.medium,
          border: `1px solid ${cockpitColors.panelBorder}`,
          background: cockpitColors.panelElevated,
          color: cockpitColors.textPrimary,
          fontWeight: 650,
        }}>
          {gateResult}
        </div>
      ) : null}

      {error ? (
        <div role="alert" data-surface="light" className="vt-light-surface" style={{
          padding: spacing.md,
          background: "#fef2f2",
          color: "#991B1B",
          borderRadius: radius.medium,
          fontWeight: 650,
        }}>
          {error}
        </div>
      ) : null}

      <div style={{ overflow: "auto", border: `1px solid ${cockpitColors.panelBorder}`, borderRadius: radius.large }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ textAlign: "left", background: cockpitColors.panelElevated }}>
              {["Section", "Sheet line", "Class", "Package", "Status", "Setup", "Monthly", "Sell?"].map((h) => (
                <th key={h} style={{ padding: "10px 12px", color: cockpitColors.textMuted, fontWeight: 700 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((row) => (
              <tr key={row.id} style={{ borderTop: `1px solid ${cockpitColors.panelBorder}` }}>
                <td style={td}>{row.sheetSection}</td>
                <td style={{ ...td, color: cockpitColors.textPrimary, fontWeight: 600 }}>{row.sheetLine}</td>
                <td style={td}>{row.offerClass}</td>
                <td style={td}>{row.packageId ?? "—"}</td>
                <td style={td}>{row.implementationStatus}</td>
                <td style={td}>{row.setupPriceUsd != null ? `$${row.setupPriceUsd.toLocaleString()}` : "—"}</td>
                <td style={td}>{row.monthlyPriceUsd != null ? `$${row.monthlyPriceUsd.toLocaleString()}` : "—"}</td>
                <td style={td}>
                  <button
                    type="button"
                    onClick={() => void checkSell(row.sheetLine)}
                    style={{
                      border: `1px solid ${cockpitColors.panelBorder}`,
                      background: cockpitColors.panel,
                      color: cockpitColors.accent,
                      borderRadius: 8,
                      padding: "4px 8px",
                      cursor: "pointer",
                      fontWeight: 650,
                    }}
                  >
                    Check
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div style={{
      padding: `${spacing.sm} ${spacing.md}`,
      borderRadius: radius.medium,
      border: `1px solid ${cockpitColors.panelBorder}`,
      background: cockpitColors.panel,
      minWidth: 120,
    }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: cockpitColors.textMuted, textTransform: "uppercase" }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 750, color: cockpitColors.textPrimary }}>{value}</div>
    </div>
  );
}

const td: CSSProperties = {
  padding: "10px 12px",
  color: cockpitColors.textSecondary,
  verticalAlign: "top",
};
