"use client";

import type { CSSProperties, ReactNode } from "react";
import { cockpitColors, motion, radius, spacing, typography } from "@/design/tokens";

export type JourneyPhase =
  | "request"
  | "pending"
  | "ready"
  | "connected"
  | "test"
  | "live"
  | "idle";

const JOURNEY_STEPS = [
  { id: "request", label: "Request" },
  { id: "pending", label: "We set up" },
  { id: "connected", label: "Connected" },
  { id: "test", label: "Test" },
  { id: "live", label: "Live" },
] as const;

/** Map owner action / status into a simple journey phase. */
export function resolveJourneyPhase(input: {
  actionKind?: string | null;
  status?: string | null;
} = {}): JourneyPhase {
  const kind = String(input.actionKind ?? "");
  const status = String(input.status ?? "").toUpperCase();
  if (kind === "request_setup") return "request";
  if (kind === "pending_ops") return "pending";
  if (kind === "good_to_go") return "ready";
  if (status === "PROVEN" || status === "VERIFIED") return "live";
  if (kind === "prove") return "test";
  if (status === "CONNECTED") return "connected";
  if (status === "CONFIGURING" || status === "NEEDS_ATTENTION") return "pending";
  return "idle";
}

function stepIndexForPhase(phase: JourneyPhase) {
  if (phase === "request" || phase === "idle") return 0;
  if (phase === "pending") return 1;
  if (phase === "ready" || phase === "connected") return 2;
  if (phase === "test") return 3;
  if (phase === "live") return 4;
  return 0;
}

/** Compact Connect → … → Live rail for a single connection. */
export function ConnectionJourneyRail({
  phase,
  compact = true,
}: {
  phase: JourneyPhase;
  compact?: boolean;
}) {
  const highlight = stepIndexForPhase(phase);
  const liveDone = phase === "live";

  return (
    <div
      aria-label="Setup progress"
      style={{
        display: "flex",
        alignItems: "center",
        gap: compact ? 4 : 8,
        flexWrap: "wrap",
        marginTop: 8,
      }}
    >
      {JOURNEY_STEPS.map((step, index) => {
        const done = liveDone || index < highlight;
        const current = !liveDone && index === highlight && phase !== "idle";
        const filled = liveDone || done || current;
        return (
          <div key={step.id} style={{ display: "flex", alignItems: "center", gap: compact ? 4 : 8 }}>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: compact ? "3px 8px" : "5px 10px",
                borderRadius: 999,
                fontSize: compact ? 10 : 11,
                fontWeight: 750,
                letterSpacing: "0.02em",
                color: filled
                  ? (current ? cockpitColors.accent : cockpitColors.handled)
                  : cockpitColors.textMuted,
                background: filled
                  ? (current ? cockpitColors.accentMuted : "rgba(52,211,153,0.12)")
                  : "rgba(15,23,42,0.55)",
                border: `1px solid ${
                  current
                    ? "rgba(34,211,238,0.45)"
                    : filled
                      ? "rgba(52,211,153,0.35)"
                      : cockpitColors.panelBorder
                }`,
                transition: `all ${motion.normal} ${motion.easing.soft}`,
                animation: current ? "vtSetupPulse 2.4s ease-in-out infinite" : undefined,
              }}
            >
              {liveDone || done ? "✓ " : `${index + 1}. `}
              {step.label}
            </span>
            {index < JOURNEY_STEPS.length - 1 ? (
              <span
                aria-hidden
                style={{
                  width: compact ? 10 : 14,
                  height: 2,
                  borderRadius: 2,
                  background: index < highlight || liveDone
                    ? "rgba(52,211,153,0.55)"
                    : cockpitColors.panelBorder,
                }}
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export function IntegrationsHero({
  connectedCount,
  needsAttentionCount,
  children,
}: {
  connectedCount: number;
  needsAttentionCount: number;
  children?: ReactNode;
}) {
  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        borderRadius: 20,
        border: `1px solid ${cockpitColors.panelBorder}`,
        background: `
          radial-gradient(ellipse 80% 80% at 0% 0%, rgba(34,211,238,0.16), transparent 55%),
          radial-gradient(ellipse 70% 60% at 100% 0%, rgba(52,211,153,0.10), transparent 50%),
          linear-gradient(165deg, #0b1220 0%, ${cockpitColors.panel} 55%, #0a101c 100%)
        `,
        padding: "22px 22px 18px",
      }}
    >
      <div style={{ display: "grid", gap: 10, maxWidth: 640 }}>
        <div style={{ fontSize: 12, fontWeight: 750, letterSpacing: "0.08em", textTransform: "uppercase", color: cockpitColors.accent }}>
          Connections
        </div>
        <h2
          style={{
            margin: 0,
            fontSize: "1.45rem",
            fontWeight: 800,
            letterSpacing: "-0.03em",
            lineHeight: 1.2,
            color: cockpitColors.textPrimary,
          }}
        >
          See what&apos;s live — and what still needs you
        </h2>
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, color: cockpitColors.textSecondary, maxWidth: 520 }}>
          Most channels are handled by VIBETech. You request setup, we connect it, then you run one real test before go-live.
        </p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 4 }}>
          <MetricChip label="Connected" value={String(connectedCount)} tone="success" />
          <MetricChip
            label="Needs you"
            value={String(needsAttentionCount)}
            tone={needsAttentionCount > 0 ? "warning" : "neutral"}
          />
        </div>
        {children}
      </div>
    </div>
  );
}

function MetricChip({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "success" | "warning" | "neutral";
}) {
  const colors =
    tone === "success"
      ? { bg: "rgba(52,211,153,0.12)", border: "rgba(52,211,153,0.35)", color: "#6ee7b7" }
      : tone === "warning"
        ? { bg: "rgba(251,191,36,0.12)", border: "rgba(251,191,36,0.35)", color: "#fbbf24" }
        : { bg: cockpitColors.panelElevated, border: cockpitColors.panelBorder, color: cockpitColors.textSecondary };
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "baseline",
        gap: 8,
        padding: "8px 12px",
        borderRadius: 12,
        background: colors.bg,
        border: `1px solid ${colors.border}`,
      }}
    >
      <span style={{ fontSize: 20, fontWeight: 800, color: colors.color, letterSpacing: "-0.03em" }}>{value}</span>
      <span style={{ fontSize: 12, fontWeight: 650, color: cockpitColors.textMuted }}>{label}</span>
    </div>
  );
}

export function SectionLabel({ children, hint }: { children: ReactNode; hint?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, marginBottom: 4 }}>
      <h3
        style={{
          margin: 0,
          fontSize: 13,
          fontWeight: 750,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: cockpitColors.textMuted,
        }}
      >
        {children}
      </h3>
      {hint ? (
        <span style={{ fontSize: 12, color: cockpitColors.textMuted, fontWeight: 500 }}>{hint}</span>
      ) : null}
    </div>
  );
}

export function ConnectionCardShell({
  accent,
  children,
  style,
}: {
  accent?: "pending" | "ready" | "live" | "idle";
  children: ReactNode;
  style?: CSSProperties;
}) {
  const accentBorder =
    accent === "pending"
      ? "rgba(251,191,36,0.45)"
      : accent === "ready"
        ? "rgba(34,211,238,0.45)"
        : accent === "live"
          ? "rgba(52,211,153,0.4)"
          : cockpitColors.panelBorder;
  const accentGlow =
    accent === "pending"
      ? "rgba(251,191,36,0.08)"
      : accent === "ready"
        ? "rgba(34,211,238,0.08)"
        : accent === "live"
          ? "rgba(52,211,153,0.07)"
          : "transparent";

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: spacing.md,
        padding: "16px 16px",
        borderRadius: 16,
        border: `1px solid ${accentBorder}`,
        background: `
          linear-gradient(135deg, ${accentGlow}, transparent 42%),
          ${cockpitColors.panelElevated}
        `,
        boxShadow: "0 10px 28px rgba(0,0,0,0.22)",
        transition: `border-color ${motion.normal} ${motion.easing.soft}, transform ${motion.fast} ${motion.easing.soft}`,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function PackageSetupProgressBar({
  complete,
  total,
}: {
  complete: number;
  total: number;
}) {
  const pct = total > 0 ? Math.min(100, Math.round((complete / total) * 100)) : 0;
  return (
    <div style={{ display: "grid", gap: 6 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 12, fontWeight: 650 }}>
        <span style={{ color: cockpitColors.textSecondary }}>{complete} of {total} steps done</span>
        <span style={{ color: cockpitColors.accent }}>{pct}%</span>
      </div>
      <div
        style={{
          height: 8,
          borderRadius: 999,
          background: "rgba(15,23,42,0.85)",
          border: `1px solid ${cockpitColors.panelBorder}`,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            borderRadius: 999,
            background: pct >= 100
              ? "linear-gradient(90deg, #34d399, #6ee7b7)"
              : "linear-gradient(90deg, #22d3ee, #38bdf8)",
            transition: `width ${motion.slow} ${motion.easing.soft}`,
          }}
        />
      </div>
    </div>
  );
}

export const setupJourneyKeyframes = `
@keyframes vtSetupPulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(34,211,238,0.0); }
  50% { box-shadow: 0 0 0 6px rgba(34,211,238,0.12); }
}
@keyframes vtSetupFadeUp {
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: translateY(0); }
}
`;
