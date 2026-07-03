import { semanticColors, spacing, typography, radius } from "@/design/tokens";

type StatusTone = "success" | "warning" | "danger" | "info" | "accent" | "neutral";

function toneColor(tone: StatusTone) {
  switch (tone) {
    case "success":
      return semanticColors.success;
    case "warning":
      return semanticColors.warning;
    case "danger":
      return semanticColors.danger;
    case "info":
      return semanticColors.info;
    case "accent":
      return semanticColors.accent;
    default:
      return semanticColors.textMuted;
  }
}

export default function StatusPill({
  tone = "neutral",
  label,
}: {
  tone?: StatusTone;
  label: string;
}) {
  const c = toneColor(tone);
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: spacing.xs,
        border: `1px solid ${semanticColors.border}`,
        borderRadius: radius.medium,
        padding: `${spacing.xs} ${spacing.sm}`,
        color: semanticColors.textPrimary,
        backgroundColor: "transparent",
      }}
      aria-label={label}
    >
      <span style={{ width: spacing.sm, height: spacing.sm, borderRadius: 9999, backgroundColor: c }} />
      <span style={{ fontSize: typography.label.fontSize, lineHeight: typography.label.lineHeight, fontWeight: typography.label.fontWeight }}>{label}</span>
    </span>
  );
}

