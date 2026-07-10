"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import PageHeader from "@/components/product/PageHeader";
import ShellPanel from "@/components/shell/ShellPanel";
import { cockpitColors, spacing, typography, radius } from "@/design/tokens";

type ReadinessCheck = {
  id: string;
  label: string;
  status: string;
  statusLabel: string;
  why: string;
  nextAction: string;
  href?: string | null;
};

export default function McBrideReadinessLayout({ businessId }: { businessId: string }) {
  const [readiness, setReadiness] = useState<{
    launchState?: string;
    summary?: Record<string, number>;
    checks?: ReadinessCheck[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const response = await fetch(`/api/businesses/${encodeURIComponent(businessId)}/readiness`);
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(String(data?.error ?? "Could not load readiness."));
        if (!cancelled) setReadiness(data.readiness ?? null);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load readiness.");
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [businessId]);

  return (
    <div style={{ display: "grid", gap: spacing.lg, padding: spacing.lg }}>
      <PageHeader
        title="Launch readiness"
        description="What is ready for McBride operations, what needs attention, and what remains deferred."
      />
      {error ? <div style={{ color: cockpitColors.warning }}>{error}</div> : null}
      <ShellPanel title="Overall launch state">
        <div style={{ padding: spacing.md, display: "grid", gap: spacing.sm }}>
          <strong style={{ fontSize: typography.cardTitle.fontSize }}>{readiness?.launchState ?? "Loading…"}</strong>
          {readiness?.summary ? (
            <div style={{ color: cockpitColors.textMuted, fontSize: typography.caption.fontSize }}>
              Ready {readiness.summary.ready} · Needs attention {readiness.summary.needsAttention} ·
              Not configured {readiness.summary.notConfigured} · Deferred {readiness.summary.deferred}
            </div>
          ) : null}
        </div>
      </ShellPanel>
      <ShellPanel title="Capability checklist">
        <div style={{ display: "grid", gap: spacing.sm, padding: spacing.md }}>
          {(readiness?.checks ?? []).map((check) => (
            <div
              key={check.id}
              style={{
                border: `1px solid ${cockpitColors.panelBorder}`,
                borderRadius: radius.medium,
                padding: spacing.sm,
                display: "grid",
                gap: 4,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: spacing.sm, flexWrap: "wrap" }}>
                <strong>{check.label}</strong>
                <span style={{ color: cockpitColors.textSecondary, fontWeight: 700 }}>{check.statusLabel}</span>
              </div>
              <div style={{ color: cockpitColors.textMuted, fontSize: typography.caption.fontSize }}>Why: {check.why}</div>
              <div style={{ color: cockpitColors.textSecondary, fontSize: typography.caption.fontSize }}>
                Next: {check.nextAction}
              </div>
              {check.href ? (
                <Link href={check.href} style={{ color: cockpitColors.accent, fontSize: typography.caption.fontSize, fontWeight: 650 }}>
                  Open related area
                </Link>
              ) : null}
            </div>
          ))}
        </div>
      </ShellPanel>
    </div>
  );
}
