"use client";

import { cockpitColors, spacing, radius, typography } from "@/design/tokens";
import type { ProductErrorView } from "@/lib/platform/productErrors";

export default function ProductErrorBanner({
  error,
  onRetry,
}: {
  error: ProductErrorView;
  onRetry?: () => void;
}) {
  return (
    <div
      role="alert"
      style={{
        borderRadius: radius.large,
        border: "1px solid rgba(185,28,28,.25)",
        background: "rgba(254,242,242,.95)",
        padding: spacing.md,
        display: "grid",
        gap: 8,
      }}
    >
      <div style={{ fontWeight: 700, color: "#991B1B" }}>{error.title}</div>
      <div style={{ color: cockpitColors.textPrimary, lineHeight: 1.5 }}>{error.message}</div>
      <div style={{ color: cockpitColors.textSecondary, fontSize: typography.caption.fontSize, lineHeight: 1.5 }}>
        What happened: {error.whatHappened}
      </div>
      <div style={{ color: cockpitColors.textSecondary, fontSize: typography.caption.fontSize }}>
        {error.dataSafe ? "Your data is safe." : "Review carefully before continuing."}
        {" "}Next: {error.nextAction}
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        {error.canRetry && onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            style={{
              border: "none",
              borderRadius: radius.medium,
              background: cockpitColors.accent,
              color: "#fff",
              fontWeight: 650,
              padding: "8px 12px",
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        ) : null}
        {error.supportReferenceId ? (
          <span style={{ fontSize: 12, color: cockpitColors.textMuted }}>
            Support ref: {error.supportReferenceId}
          </span>
        ) : null}
      </div>
    </div>
  );
}
