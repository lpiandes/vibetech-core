import { semanticColors, spacing, typography, radius, shadows, opacity } from "@/design/tokens";

export default function InsightCard({
  title,
  category,
  message,
  importance,
}: {
  title: string;
  category: string;
  message: string;
  importance: "low" | "medium" | "high";
}) {
  const impTone = importance === "high" ? semanticColors.danger : importance === "medium" ? semanticColors.warning : semanticColors.textMuted;

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
            Category: {category}
          </div>
        </div>
        <div
          style={{
            padding: `${spacing.xs} ${spacing.sm}`,
            borderRadius: radius.medium,
            border: `1px solid ${semanticColors.border}`,
            color: impTone,
            opacity: opacity.high,
            fontSize: typography.caption.fontSize,
            lineHeight: typography.caption.lineHeight,
            fontWeight: typography.caption.fontWeight,
          }}
        >
          {importance.charAt(0).toUpperCase() + importance.slice(1)}
        </div>
      </div>

      <div style={{ marginTop: spacing.md, color: semanticColors.textPrimary, fontSize: typography.body.fontSize, lineHeight: typography.body.lineHeight, fontWeight: typography.body.fontWeight }}>
        {message}
      </div>
    </section>
  );
}

