import { cockpitColors, typography, radius } from "@/design/tokens";

export type StatusBadgeTone = "neutral" | "success" | "warning" | "info";

const TONE_STYLES: Record<StatusBadgeTone, { bg: string; color: string }> = {
  neutral: { bg: cockpitColors.panelElevated, color: cockpitColors.textSecondary },
  success: { bg: "rgba(52,211,153,0.14)", color: "#6ee7b7" },
  warning: { bg: "rgba(251,191,36,0.14)", color: "#fbbf24" },
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
