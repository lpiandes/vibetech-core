import { cockpitColors, typography, radius } from "@/design/tokens";

export type StatusBadgeTone = "neutral" | "success" | "warning" | "info";

const TONE_STYLES: Record<StatusBadgeTone, { bg: string; color: string }> = {
  neutral: { bg: cockpitColors.panelElevated, color: cockpitColors.textMuted },
  success: { bg: "rgba(34,197,94,0.12)", color: "#15803d" },
  warning: { bg: "rgba(245,158,11,0.12)", color: "#b45309" },
  info: { bg: cockpitColors.accentMuted, color: cockpitColors.accent },
};

export default function StatusBadge({ label, tone = "neutral" }: { label: string; tone?: StatusBadgeTone }) {
  const style = TONE_STYLES[tone];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        borderRadius: radius.pill,
        padding: "3px 10px",
        fontSize: typography.caption.fontSize,
        fontWeight: 600,
        lineHeight: 1.2,
        backgroundColor: style.bg,
        color: style.color,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}
