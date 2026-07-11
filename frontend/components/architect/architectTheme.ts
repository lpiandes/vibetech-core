/** Premium Architect design tokens — Apple/Linear inspired. */
export const architect = {
  font: '"Segoe UI", "SF Pro Display", "Helvetica Neue", system-ui, sans-serif',
  display: '"Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif',
  bg: "radial-gradient(1200px 600px at 10% -10%, #1e293b 0%, #0b1220 45%, #070b14 100%)",
  bgLight: "linear-gradient(180deg, #F8FAFC 0%, #EEF2FF 50%, #F1F5F9 100%)",
  ink: "#E8EEF7",
  inkMuted: "rgba(226, 232, 240, 0.62)",
  inkDark: "#0F172A",
  mutedDark: "#64748B",
  panel: "rgba(15, 23, 42, 0.72)",
  panelSolid: "#111827",
  panelLight: "#FFFFFF",
  border: "rgba(148, 163, 184, 0.18)",
  borderLight: "rgba(15, 23, 42, 0.08)",
  accent: "#14B8A6",
  accentSoft: "rgba(20, 184, 166, 0.16)",
  accentSecondary: "#38BDF8",
  success: "#34D399",
  warning: "#FBBF24",
  danger: "#F87171",
  shadow: "0 24px 80px rgba(0, 0, 0, 0.35)",
  shadowLight: "0 18px 50px rgba(15, 23, 42, 0.08)",
  radius: 20,
  radiusSm: 14,
} as const;

export const architectKeyframes = `
@keyframes architectFadeUp {
  from { opacity: 0; transform: translateY(10px); }
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
`;
