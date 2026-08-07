"use client";

import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { Button } from "@/components/ui/button";
import { cockpitColors, spacing, typography, radius } from "@/design/tokens";

type StepView = {
  id: string;
  label: string;
  done: boolean;
  at?: string | null;
};

type CustomBuildView = {
  sheetLine?: string;
  playbookTitle?: string | null;
  requiredProveMissionIds?: string[];
  steps?: StepView[];
  summary?: {
    completeCount?: number;
    totalSteps?: number;
    complete?: boolean;
    nextStepId?: string | null;
    canGoLive?: boolean;
    proveComplete?: boolean;
    missingProveMissionIds?: string[];
  };
};

/**
 * Custom Build Factory progress on Today for non-RFT engagements.
 */
export default function CustomBuildPath({
  businessId,
  defaultSheetLine = "Custom AI Application",
}: {
  businessId: string;
  defaultSheetLine?: string;
}) {
  const [view, setView] = useState<CustomBuildView | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sheetLine, setSheetLine] = useState(defaultSheetLine);
  const [industry, setIndustry] = useState("services");
  const [outcome, setOutcome] = useState("Acknowledge and follow up inbound opportunities");
  const [channels, setChannels] = useState("email, forms");

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/businesses/${encodeURIComponent(businessId)}/custom-build`);
    const data = await res.json().catch(() => ({}));
    setView(data.customBuild ?? null);
  }, [businessId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function start() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/businesses/${encodeURIComponent(businessId)}/custom-build`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "start",
          sheetLine,
          brief: {
            industry,
            outcome,
            channels: channels.split(",").map((c) => c.trim()).filter(Boolean),
          },
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Could not start custom build");
      setView(data.customBuild ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function advance(stepId: string) {
    setBusy(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = { action: "advance", stepId };
      if (stepId === "intake") {
        payload.brief = {
          industry,
          outcome,
          channels: channels.split(",").map((c) => c.trim()).filter(Boolean),
        };
      }
      if (stepId === "acceptance") {
        payload.checklistIds = ["channels", "sample_case", "approvals", "escalation"];
        payload.evidence = { accepted: true, checklistIds: payload.checklistIds };
      }
      if (stepId === "prove") {
        payload.evidence = { source: "capability_proof_records" };
      }
      const res = await fetch(`/api/businesses/${encodeURIComponent(businessId)}/custom-build`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Could not advance step");
      setView(data.customBuild ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  function advanceLabel(stepId: string) {
    if (stepId === "prove") return "Verify prove records";
    if (stepId === "acceptance") return "Accept checklist";
    if (stepId === "go_live") return "Go live";
    if (stepId === "intake") return "Save intake";
    return "Mark done";
  }

  return (
    <section
      aria-label="Custom Build Factory"
      style={{
        display: "grid",
        gap: spacing.md,
        padding: spacing.lg,
        borderRadius: radius.large,
        border: `1px solid ${cockpitColors.panelBorder}`,
        background: cockpitColors.panel,
      }}
    >
      <div>
        <h2 style={{ margin: 0, fontSize: typography.cardTitle.fontSize, fontWeight: 700, color: cockpitColors.textPrimary }}>
          Custom Build Factory
        </h2>
        <p style={{ margin: `${spacing.xs} 0 0`, color: cockpitColors.textSecondary, fontSize: 14, lineHeight: 1.45 }}>
          Deliver any custom AI build end-to-end: intake → prove → acceptance → go-live. Prove steps read live capability proof records — operator clicks alone cannot go live.
        </p>
      </div>

      {!view ? (
        <div style={{ display: "grid", gap: spacing.sm }}>
          <label style={{ fontSize: 12, fontWeight: 650, color: cockpitColors.textMuted }}>
            Sheet line
            <input
              value={sheetLine}
              onChange={(e) => setSheetLine(e.target.value)}
              style={inputStyle()}
            />
          </label>
          <label style={{ fontSize: 12, fontWeight: 650, color: cockpitColors.textMuted }}>
            Industry
            <input value={industry} onChange={(e) => setIndustry(e.target.value)} style={inputStyle()} />
          </label>
          <label style={{ fontSize: 12, fontWeight: 650, color: cockpitColors.textMuted }}>
            Outcome
            <input value={outcome} onChange={(e) => setOutcome(e.target.value)} style={inputStyle()} />
          </label>
          <label style={{ fontSize: 12, fontWeight: 650, color: cockpitColors.textMuted }}>
            Channels (comma-separated)
            <input value={channels} onChange={(e) => setChannels(e.target.value)} style={inputStyle()} />
          </label>
          <Button type="button" disabled={busy} onClick={() => void start()}>
            Start custom build
          </Button>
        </div>
      ) : (
        <div style={{ display: "grid", gap: spacing.sm }}>
          <div style={{ color: cockpitColors.textPrimary, fontWeight: 650 }}>
            {view.sheetLine}
            {view.playbookTitle ? ` · ${view.playbookTitle}` : ""}
          </div>
          <div style={{ color: cockpitColors.textMuted, fontSize: 12 }}>
            {view.summary?.completeCount ?? 0}/{view.summary?.totalSteps ?? 8} steps
            {view.summary?.complete ? " · Complete" : ""}
          </div>
          {(view.summary?.missingProveMissionIds?.length ?? 0) > 0 ? (
            <p style={{ margin: 0, fontSize: 12, color: "#991B1B" }}>
              Missing prove: {view.summary?.missingProveMissionIds?.join(", ")}
            </p>
          ) : null}
          <ol style={{ margin: 0, paddingLeft: spacing.lg, display: "grid", gap: 8 }}>
            {(view.steps ?? []).map((step) => (
              <li key={step.id} style={{ color: step.done ? cockpitColors.handled : cockpitColors.textSecondary }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <span style={{ fontWeight: 600 }}>
                    {step.done ? "✓" : "○"} {step.label}
                  </span>
                  {!step.done && view.summary?.nextStepId === step.id ? (
                    <Button type="button" disabled={busy} onClick={() => void advance(step.id)}>
                      {advanceLabel(step.id)}
                    </Button>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
          {(view.requiredProveMissionIds?.length ?? 0) > 0 ? (
            <p style={{ margin: 0, fontSize: 12, color: cockpitColors.textMuted }}>
              Prove missions: {view.requiredProveMissionIds?.join(", ")}
            </p>
          ) : null}
        </div>
      )}

      {error ? (
        <div role="alert" data-surface="light" className="vt-light-surface" style={{
          padding: spacing.md,
          borderRadius: radius.medium,
          background: "#fef2f2",
          color: "#991B1B",
          fontWeight: 650,
        }}>
          {error}
        </div>
      ) : null}
    </section>
  );
}

function inputStyle(): CSSProperties {
  return {
    display: "block",
    width: "100%",
    marginTop: 6,
    height: 36,
    borderRadius: radius.medium,
    border: `1px solid ${cockpitColors.panelBorder}`,
    background: cockpitColors.panelElevated,
    color: cockpitColors.textPrimary,
    padding: `0 ${spacing.sm}`,
  };
}
