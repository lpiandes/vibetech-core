"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  VtCard,
  VtEmpty,
  VtPanel,
} from "@/components/product/VtChrome";
import { cockpitColors, spacing, typography, radius } from "@/design/tokens";

type Candidate = {
  candidateId: string;
  status: string;
  patternKind?: string;
  title?: string;
  structure?: Record<string, unknown>;
  provenance?: {
    anonymizedTenantCount?: number;
    sampleCount?: number;
    sourceTypes?: string[];
    rootCauseDistribution?: Record<string, number>;
  };
  publishedBlueprintId?: string | null;
};

/**
 * Plan 12 — review scrubbed delivery patterns before blueprint publish.
 */
export default function DeliveryMoatClient() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [published, setPublished] = useState<Array<{ blueprintId: string; title?: string; patternKind?: string }>>([]);
  const [honesty, setHonesty] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/delivery-moat");
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.ok === false) {
      setError(data.error ?? data.message ?? "Could not load moat catalog");
      return;
    }
    setCandidates(Array.isArray(data.catalog?.candidates) ? data.catalog.candidates : []);
    setPublished(Array.isArray(data.catalog?.published) ? data.catalog.published : []);
    setHonesty(data.honesty?.message ?? null);
    setError(null);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function post(action: string, extra: Record<string, unknown> = {}) {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/delivery-moat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...extra }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.ok === false) {
        setError(data.message ?? data.error ?? data.code ?? "Action failed");
        return;
      }
      if (data.catalog) {
        setCandidates(data.catalog.candidates ?? []);
        setPublished(data.catalog.published ?? []);
      }
      if (data.honesty?.message) setHonesty(data.honesty.message);
      if (action === "promote") {
        setMessage(`Published ${data.blueprint?.blueprintId ?? data.published?.blueprintId ?? "pattern"}`);
      } else if (action === "extract") {
        setMessage(`Extracted ${(data.catalog?.candidates ?? []).length} candidate(s)`);
      }
    } finally {
      setBusy(false);
    }
  }

  const open = candidates.filter((c) => c.status === "candidate");

  return (
    <div style={{ display: "grid", gap: spacing.lg }}>
      <VtPanel>
        <div style={{ display: "flex", justifyContent: "space-between", gap: spacing.md, flexWrap: "wrap", alignItems: "center" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: typography.cardTitle.fontSize, fontWeight: 700 }}>
              Pattern candidates
            </h2>
            <p style={{ margin: `${spacing.xs} 0 0`, color: cockpitColors.textSecondary, fontSize: typography.meta.fontSize }}>
              Scrubbed operating patterns from root causes, Company Rules, and autonomy gates.
              Never auto-applied to live customer contracts.
            </p>
          </div>
          <Button type="button" size="sm" disabled={busy} onClick={() => post("extract")}>
            Extract from delivery
          </Button>
        </div>
        {honesty ? (
          <p style={{ margin: `${spacing.sm} 0 0`, color: cockpitColors.textMuted, fontSize: typography.meta.fontSize }}>
            {honesty}
          </p>
        ) : null}
        {error ? (
          <p style={{ margin: `${spacing.sm} 0 0`, color: cockpitColors.critical, fontSize: typography.meta.fontSize }}>
            {error}
          </p>
        ) : null}
        {message ? (
          <p style={{ margin: `${spacing.sm} 0 0`, color: cockpitColors.handled, fontSize: typography.meta.fontSize }}>
            {message}
          </p>
        ) : null}
      </VtPanel>

      {!open.length ? (
        <VtEmpty
          title="No open candidates"
          description="Extract from delivery after operator cases and Company Rules have volume."
        />
      ) : (
        <div style={{ display: "grid", gap: spacing.md }}>
          {open.map((c) => (
            <VtCard key={c.candidateId}>
              <div style={{ display: "grid", gap: spacing.sm }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: spacing.md, flexWrap: "wrap" }}>
                  <strong>{c.title ?? c.candidateId}</strong>
                  <span style={{ fontSize: typography.meta.fontSize, color: cockpitColors.textMuted }}>
                    {String(c.patternKind ?? "").replace(/_/g, " ")}
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: typography.meta.fontSize, color: cockpitColors.textSecondary }}>
                  Tenants (anonymized): {c.provenance?.anonymizedTenantCount ?? 0}
                  {" · "}samples: {c.provenance?.sampleCount ?? 0}
                  {" · "}sources: {(c.provenance?.sourceTypes ?? []).join(", ") || "—"}
                </p>
                {c.provenance?.rootCauseDistribution ? (
                  <p style={{ margin: 0, fontSize: typography.meta.fontSize, color: cockpitColors.textMuted }}>
                    Causes:{" "}
                    {Object.entries(c.provenance.rootCauseDistribution)
                      .map(([code, n]) => `${code.replace(/_/g, " ")} (${n})`)
                      .join("; ")}
                  </p>
                ) : null}
                <pre
                  style={{
                    margin: 0,
                    padding: spacing.sm,
                    borderRadius: radius.medium,
                    background: cockpitColors.inset,
                    fontSize: 11,
                    overflow: "auto",
                    maxHeight: 160,
                  }}
                >
                  {JSON.stringify(c.structure ?? {}, null, 2)}
                </pre>
                <div style={{ display: "flex", gap: spacing.sm, flexWrap: "wrap" }}>
                  <Button
                    type="button"
                    size="sm"
                    disabled={busy}
                    onClick={() => post("promote", { candidateId: c.candidateId })}
                  >
                    Promote to library
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={busy}
                    onClick={() => post("reject", { candidateId: c.candidateId })}
                  >
                    Reject
                  </Button>
                </div>
              </div>
            </VtCard>
          ))}
        </div>
      )}

      {published.length > 0 ? (
        <VtPanel>
          <h3 style={{ margin: 0, fontSize: typography.meta.fontSize, fontWeight: 700 }}>
            Published moat patterns
          </h3>
          <ul style={{ margin: `${spacing.sm} 0 0`, paddingLeft: spacing.lg }}>
            {published.map((p) => (
              <li key={p.blueprintId} style={{ fontSize: typography.meta.fontSize, color: cockpitColors.textSecondary }}>
                {p.title ?? p.blueprintId}
                {" · "}
                <Link href="/admin/blueprints">{p.blueprintId}</Link>
              </li>
            ))}
          </ul>
        </VtPanel>
      ) : null}
    </div>
  );
}
