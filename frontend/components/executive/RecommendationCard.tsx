import { semanticColors, spacing, typography, radius, shadows, opacity } from "@/design/tokens";

export default function RecommendationCard({
  title,
  actionType,
  priority,
  recommendation,
}: {
  title: string;
  actionType: string;
  priority: number;
  recommendation: string;
}) {
  const prTone = priority >= 80 ? semanticColors.danger : priority >= 60 ? semanticColors.warning : semanticColors.textMuted;

  return (
    <section
      style={{
        backgroundColor: semanticColors.surface,
        border: `1px solid ${semanticColors.border}`,
        borderRadius: radius.large,
        boxShadow: shadows.subtle,
        padding: spacing.lg,
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: spacing.md }}>
        <div>
          <div style={{ color: semanticColors.textPrimary, fontSize: typography.cardTitle.fontSize, lineHeight: typography.cardTitle.lineHeight, fontWeight: typography.cardTitle.fontWeight }}>
            {title}
          </div>
          <div style={{ marginTop: spacing.xs, color: semanticColors.textSecondary, fontSize: typography.caption.fontSize, lineHeight: typography.caption.lineHeight, fontWeight: typography.caption.fontWeight }}>
            Action: {actionType}
          </div>
        </div>
        <div
          style={{
            padding: `${spacing.xs} ${spacing.sm}`,
            borderRadius: radius.medium,
            border: `1px solid ${semanticColors.border}`,
            color: prTone,
            backgroundColor: "transparent",
            opacity: opacity.high,
            fontSize: typography.caption.fontSize,
            lineHeight: typography.caption.lineHeight,
            fontWeight: typography.caption.fontWeight,
            whiteSpace: "nowrap",
          }}
        >
          Priority: {priority}
        </div>
      </div>

      <div style={{ marginTop: spacing.md, color: semanticColors.textPrimary, fontSize: typography.body.fontSize, lineHeight: typography.body.lineHeight, fontWeight: typography.body.fontWeight }}>
        {recommendation}
      </div>
    </section>
  );
}

