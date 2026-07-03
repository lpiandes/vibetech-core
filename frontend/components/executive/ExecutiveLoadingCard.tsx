import { semanticColors, spacing, typography, radius, opacity } from "@/design/tokens";

export default function ExecutiveLoadingCard({ label }: { label?: string }) {
  return (
    <section
      style={{
        backgroundColor: semanticColors.surface,
        border: `1px solid ${semanticColors.border}`,
        borderRadius: radius.large,
        padding: spacing.lg,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: spacing.sm }}>
        <div style={{ height: spacing.sm, width: "40%", backgroundColor: semanticColors.textMuted, opacity: opacity.veryLow, borderRadius: radius.medium }} />
        <div style={{ height: spacing.md, width: "70%", backgroundColor: semanticColors.textMuted, opacity: opacity.veryLow, borderRadius: radius.medium }} />
        <div style={{ height: spacing.xs, width: "55%", backgroundColor: semanticColors.textMuted, opacity: opacity.veryLow, borderRadius: radius.medium }} />
        <div style={{ height: spacing.xl, width: "60%", backgroundColor: semanticColors.textMuted, opacity: opacity.veryLow, borderRadius: radius.medium }} />
      </div>
      {label ? (
        <div style={{ marginTop: spacing.sm, color: semanticColors.textSecondary, fontSize: typography.caption.fontSize, lineHeight: typography.caption.lineHeight, fontWeight: typography.caption.fontWeight, opacity: opacity.medium }}>
          {label}
        </div>
      ) : null}
    </section>
  );
}

