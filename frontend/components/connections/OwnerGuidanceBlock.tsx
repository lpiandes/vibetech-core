"use client";

import { cockpitColors, spacing } from "@/design/tokens";

/** Shared ordered steps for prove / setup hand-holding. */
export function OwnerStepList({
  steps,
  tone = "default",
}: {
  steps: string[];
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
      {steps.map((step, i) => (
        <li key={`owner_step_${i}`}>{step}</li>
      ))}
    </ol>
  );
}

export function OwnerGuidanceBlock({
  title,
  steps,
  tone = "default",
}: {
  title?: string | null;
  steps: string[];
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
      <OwnerStepList steps={steps} tone={tone} />
    </div>
  );
}
