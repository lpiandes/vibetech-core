/** Premium Architect design tokens — consultant-grade, not default AI purple. */
export const architect = {
  font: '"Segoe UI", "SF Pro Text", "Helvetica Neue", system-ui, sans-serif',
  display: '"Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif',
  bg: "radial-gradient(1100px 640px at 8% -8%, #1a2f38 0%, #0b1419 42%, #070c10 100%)",
  bgLight: "linear-gradient(180deg, #F7F8F6 0%, #EEF3F1 48%, #F3F5F4 100%)",
  ink: "#E8EEF2",
  inkMuted: "rgba(226, 232, 240, 0.62)",
  inkDark: "#0F172A",
  mutedDark: "#64748B",
  panel: "rgba(12, 20, 26, 0.78)",
  panelSolid: "#0F171C",
  panelLight: "#FFFFFF",
  border: "rgba(148, 163, 184, 0.16)",
  borderLight: "rgba(15, 23, 42, 0.08)",
  accent: "#14B8A6",
  accentSoft: "rgba(20, 184, 166, 0.16)",
  accentSecondary: "#5EEAD4",
  success: "#34D399",
  warning: "#FBBF24",
  danger: "#F87171",
  shadow: "0 28px 80px rgba(0, 0, 0, 0.38)",
  shadowLight: "0 18px 50px rgba(15, 23, 42, 0.08)",
  radius: 22,
  radiusSm: 14,
} as const;

export const architectKeyframes = `
@keyframes architectFadeUp {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes architectPulse {
  0%, 100% { opacity: 0.45; }
  50% { opacity: 1; }
}
@keyframes architectShimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
@keyframes architectSpin {
  to { transform: rotate(360deg); }
}
@keyframes architectDnaFill {
  from { stroke-dashoffset: 120; opacity: 0.35; }
  to { stroke-dashoffset: 0; opacity: 1; }
}
@keyframes architectAssembleIn {
  from { opacity: 0; transform: translateY(16px) scale(0.98); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes architectCrossfade {
  from { opacity: 0; }
  to { opacity: 1; }
}
`;
