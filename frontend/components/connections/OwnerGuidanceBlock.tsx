"use client";

import Link from "next/link";
import { cockpitColors, spacing } from "@/design/tokens";

export type OwnerGuidanceStep = string | { text: string; href?: string | null };
export type OwnerEvidenceRow = { label: string; value: string };

/** Shared ordered steps for prove / setup hand-holding. */
export function OwnerStepList({
  steps,
  tone = "default",
}: {
  steps: OwnerGuidanceStep[];
  tone?: "default" | "success" | "danger";
}) {
  if (!Array.isArray(steps) || steps.length === 0) return null;
  const color =
    tone === "success"
      ? cockpitColors.handled
      : tone === "danger"
        ? "#b91c1c"
        : cockpitColors.textSecondary;
  return (
    <ol
      style={{
        margin: 0,
        paddingLeft: 18,
        display: "grid",
        gap: 6,
        fontSize: 14,
        lineHeight: 1.45,
        color,
      }}
    >
      {steps.map((step, i) => {
        const text = typeof step === "string" ? step : step.text;
        const href = typeof step === "string" ? null : (step.href ?? null);
        return (
          <li key={`owner_step_${i}`}>
            {href ? (
              <Link href={href} style={{ color: cockpitColors.accent, fontWeight: 650, textDecoration: "underline" }}>
                {text}
              </Link>
            ) : (
              text
            )}
          </li>
        );
      })}
    </ol>
  );
}

export function OwnerEvidenceList({ evidence }: { evidence: OwnerEvidenceRow[] }) {
  if (!Array.isArray(evidence) || evidence.length === 0) return null;
  return (
    <div
      style={{
        display: "grid",
        gap: 6,
        padding: 12,
        borderRadius: 10,
        border: `1px solid ${cockpitColors.panelBorder}`,
        background: cockpitColors.panelElevated,
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 750, letterSpacing: "0.06em", textTransform: "uppercase", color: cockpitColors.textMuted }}>
        Proof
      </div>
      {evidence.map((row, i) => (
        <div key={`ev_${i}`} style={{ display: "grid", gap: 2 }}>
          <div style={{ fontSize: 12, fontWeight: 650, color: cockpitColors.textMuted }}>{row.label}</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: cockpitColors.textPrimary, lineHeight: 1.4 }}>{row.value}</div>
        </div>
      ))}
    </div>
  );
}

export function OwnerGuidanceBlock({
  title,
  steps,
  evidence = [],
  tone = "default",
}: {
  title?: string | null;
  steps: OwnerGuidanceStep[];
  evidence?: OwnerEvidenceRow[];
  tone?: "default" | "success" | "danger";
}) {
  return (
    <div style={{ display: "grid", gap: spacing.sm }}>
      {title ? (
        <div
          style={{
            fontWeight: 700,
            fontSize: 15,
            color:
              tone === "success"
                ? cockpitColors.handled
                : tone === "danger"
                  ? "#b91c1c"
                  : cockpitColors.textPrimary,
          }}
        >
          {title}
        </div>
      ) : null}
      <OwnerEvidenceList evidence={evidence} />
      <OwnerStepList steps={steps} tone={tone} />
    </div>
  );
}
