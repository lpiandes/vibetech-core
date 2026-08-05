"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { cockpitColors, spacing, typography, radius } from "@/design/tokens";

type Evaluation = {
  classId: string;
  label?: string;
  risk?: string;
  description?: string;
  status: string;
  autoEligible?: boolean;
  metrics?: {
    sampleSize?: number;
    approvalRate?: number;
    editRate?: number;
    criticalIncidents?: number;
  } | null;
  reasons?: string[];
  gates?: { passed?: boolean } | null;
};

/**
 * Plan 11 — “What can run without me?”
 * Default deny. Delegate / revoke per action class.
 */
export default function EarnedAutonomyPanel({ businessId }: { businessId: string }) {
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const api = `/api/businesses/${encodeURIComponent(businessId)}/earned-autonomy`;

  const post = useCallback(async (action: string, extra: Record<string, unknown> = {}) => {
    setBusy(action + String(extra.classId ?? ""));
    setError(null);
    try {
      const res = await fetch(api, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...extra }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) {
        setError(json.message ?? json.error ?? json.code ?? "Action failed.");
        return;
      }
      setEvaluations(json.evaluations ?? []);
    } finally {
      setBusy(null);
    }
  }, [api]);

  useEffect(() => {
    void post("refresh");
  }, [post]);

  return (
    <section style={panelStyle} aria-label="Earned autonomy">
      <h2 style={{ margin: 0, fontSize: typography.cardTitle.fontSize, fontWeight: 700 }}>
        What can run without me?
      </h2>
      <p style={{ margin: `${spacing.sm} 0 0`, color: cockpitColors.textSecondary, fontSize: typography.meta.fontSize }}>
        Autonomy is earned per action class from approval/edit rates, incidents, Plan 7 replay/shadow,
        and your explicit delegation — never a global auto-send switch.
      </p>

      {error ? (
        <p style={{ margin: `${spacing.sm} 0 0`, color: cockpitColors.critical, fontSize: typography.meta.fontSize }}>
          {error}
        </p>
      ) : null}

      <div style={{ display: "grid", gap: spacing.md, marginTop: spacing.md }}>
        {evaluations.map((ev) => {
          const pct = (n?: number) =>
            n == null ? "—" : `${Math.round(n * 100)}%`;
          return (
            <article
              key={ev.classId}
              style={{
                padding: spacing.md,
                borderRadius: radius.medium,
                border: `1px solid ${cockpitColors.panelBorder}`,
                display: "grid",
                gap: spacing.sm,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: spacing.md, flexWrap: "wrap" }}>
                <strong>{ev.label ?? ev.classId}</strong>
                <span style={{ fontSize: typography.meta.fontSize, color: cockpitColors.textMuted }}>
                  {ev.risk} · {String(ev.status).replace(/_/g, " ")}
                </span>
              </div>
              {ev.description ? (
                <p style={{ margin: 0, color: cockpitColors.textSecondary, fontSize: typography.meta.fontSize }}>
                  {ev.description}
                </p>
              ) : null}
              <p style={{ margin: 0, color: cockpitColors.textMuted, fontSize: typography.meta.fontSize }}>
                Sample {ev.metrics?.sampleSize ?? 0}
                {" · "}approval {pct(ev.metrics?.approvalRate)}
                {" · "}edit {pct(ev.metrics?.editRate)}
                {" · "}critical incidents {ev.metrics?.criticalIncidents ?? 0}
                {ev.gates?.passed ? " · Plan 7 gates ok" : " · Plan 7 gates incomplete"}
              </p>
              {ev.autoEligible ? null : ev.reasons?.length ? (
                <p style={{ margin: 0, color: cockpitColors.textMuted, fontSize: typography.meta.fontSize }}>
                  Blocked by: {ev.reasons.slice(0, 4).map((r) => r.replace(/_/g, " ")).join("; ")}
                </p>
              ) : null}
              <div style={{ display: "flex", gap: spacing.sm, flexWrap: "wrap" }}>
                {ev.status === "eligible_pending_delegation" ? (
                  <Button
                    type="button"
                    size="sm"
                    disabled={busy !== null}
                    onClick={() => post("delegate", { classId: ev.classId })}
                  >
                    Allow without me
                  </Button>
                ) : null}
                {ev.autoEligible ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={busy !== null}
                    onClick={() => post("revoke", { classId: ev.classId })}
                  >
                    Revoke
                  </Button>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

const panelStyle = {
  padding: spacing.lg,
  borderRadius: radius.large,
  background: cockpitColors.panel,
  border: `1px solid ${cockpitColors.panelBorder}`,
} as const;
