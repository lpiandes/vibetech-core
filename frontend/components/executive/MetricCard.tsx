import { semanticColors, spacing, typography, radius, shadows, opacity } from "@/design/tokens";

export default function MetricCard({
  title,
  value,
  badge,
  status,
  priority,
}: {
  title: string;
  value: number | string;
  badge?: string;
  status?: string;
  priority?: string;
}) {
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
        <div style={{ color: semanticColors.textPrimary, fontSize: typography.cardTitle.fontSize, lineHeight: typography.cardTitle.lineHeight, fontWeight: typography.cardTitle.fontWeight }}>
          {title}
        </div>
        {badge ? (
          <div style={{ padding: `${spacing.xs} ${spacing.sm}`, borderRadius: radius.medium, border: `1px solid ${semanticColors.border}`, color: semanticColors.textSecondary, backgroundColor: "transparent", opacity: opacity.medium }}>
            {badge}
          </div>
        ) : null}
      </div>

      <div style={{ marginTop: spacing.md, color: semanticColors.textPrimary, fontSize: typography.metric.fontSize, lineHeight: typography.metric.lineHeight, fontWeight: typography.metric.fontWeight }}>
        {value}
      </div>

      {status || priority ? (
        <div style={{ marginTop: spacing.xs, display: "flex", flexWrap: "wrap", gap: spacing.xs }}>
          {status ? <div style={{ color: semanticColors.textMuted, fontSize: typography.caption.fontSize, lineHeight: typography.caption.lineHeight, fontWeight: typography.caption.fontWeight }}>Status: {status}</div> : null}
          {priority ? <div style={{ color: semanticColors.textMuted, fontSize: typography.caption.fontSize, lineHeight: typography.caption.lineHeight, fontWeight: typography.caption.fontWeight }}>{priority}</div> : null}
        </div>
      ) : null}
    </section>
  );
}

