import { semanticColors, spacing, typography, radius, shadows } from "@/design/tokens";
import HealthBadge, { type HealthLevel } from "./HealthBadge";

export default function BusinessHealthCard({
  title,
  score,
  level,
  summary,
}: {
  title: string;
  score: number;
  level: HealthLevel;
  summary?: string;
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
        <div>
          <div style={{ color: semanticColors.textPrimary, fontSize: typography.sectionTitle.fontSize, lineHeight: typography.sectionTitle.lineHeight, fontWeight: typography.sectionTitle.fontWeight }}>
            {title}
          </div>
          <div style={{ marginTop: spacing.xs, color: semanticColors.textSecondary, fontSize: typography.caption.fontSize, lineHeight: typography.caption.lineHeight, fontWeight: typography.caption.fontWeight }}>
            {summary ?? ""}
          </div>
        </div>
        <HealthBadge level={level} />
      </div>

      <div style={{ marginTop: spacing.lg, color: semanticColors.textPrimary, fontSize: typography.metric.fontSize, lineHeight: typography.metric.lineHeight, fontWeight: typography.metric.fontWeight }}>
        {score}%
      </div>
    </section>
  );
}

