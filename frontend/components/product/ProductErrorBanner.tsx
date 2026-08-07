"use client";

import { cockpitColors, spacing, radius, typography } from "@/design/tokens";
import type { ProductErrorView } from "@/lib/platform/productErrors";

/**
 * Always a light alert surface — never inherit shell light-on-dark text colors.
 */
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
      data-surface="light"
      className="vt-light-surface"
      style={{
        borderRadius: radius.large,
        border: "1px solid rgba(185,28,28,.35)",
        background: "#fef2f2",
        padding: spacing.md,
        display: "grid",
        gap: 8,
        color: cockpitColors.inkOnLight,
      }}
    >
      <div style={{ fontWeight: 700, color: "#991B1B" }}>{error.title}</div>
      <div style={{ color: cockpitColors.inkOnLight, lineHeight: 1.5 }}>{error.message}</div>
      <div style={{ color: cockpitColors.inkMutedOnLight, fontSize: typography.caption.fontSize, lineHeight: 1.5 }}>
        What happened: {error.whatHappened}
      </div>
      <div style={{ color: cockpitColors.inkMutedOnLight, fontSize: typography.caption.fontSize }}>
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
              color: "#0f172a",
              fontWeight: 650,
              padding: "8px 12px",
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        ) : null}
        {error.supportReferenceId ? (
          <span style={{ fontSize: 12, color: cockpitColors.inkMutedOnLight }}>
            Support ref: {error.supportReferenceId}
          </span>
        ) : null}
      </div>
    </div>
  );
}
