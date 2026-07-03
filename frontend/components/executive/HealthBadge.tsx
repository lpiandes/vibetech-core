import { semanticColors, radius, spacing, typography } from "@/design/tokens";

export type HealthLevel = "excellent" | "good" | "warning" | "critical";

function levelColor(level: HealthLevel) {
  switch (level) {
    case "excellent":
      return semanticColors.healthExcellent;
    case "good":
      return semanticColors.healthGood;
    case "warning":
      return semanticColors.healthWarning;
    case "critical":
      return semanticColors.healthCritical;
  }
}

export default function HealthBadge({ level }: { level: HealthLevel }) {
  const c = levelColor(level);
  const label = level.charAt(0).toUpperCase() + level.slice(1);

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: spacing.xs,
        borderRadius: radius.pill,
        border: `1px solid ${semanticColors.border}`,
        padding: `${spacing.xs} ${spacing.sm}`,
        color: semanticColors.textPrimary,
      }}
    >
      <span style={{ width: spacing.sm, height: spacing.sm, borderRadius: 9999, backgroundColor: c }} />
      <span style={{ fontSize: typography.label.fontSize, lineHeight: typography.label.lineHeight, fontWeight: typography.label.fontWeight }}>{label}</span>
    </span>
  );
}

