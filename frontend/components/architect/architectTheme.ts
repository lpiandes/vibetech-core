/**
 * Architect / Ask tokens — aligned to product brand (cyan on deep navy).
 * Keep in sync with frontend/design/tokens/brand.ts.
 */
import { brand } from "@/design/tokens/brand";

export const architect = {
  font: '"Segoe UI", "SF Pro Text", "Helvetica Neue", system-ui, sans-serif',
  display: '"Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif',
  bg: `radial-gradient(1100px 640px at 8% -8%, #122033 0%, ${brand.bgDeep} 42%, #05080f 100%)`,
  bgLight: "linear-gradient(180deg, #F7F8F6 0%, #EEF3F1 48%, #F3F5F4 100%)",
  ink: brand.text,
  inkMuted: brand.textMuted,
  inkDark: brand.navy,
  mutedDark: brand.textMuted,
  panel: brand.surface,
  panelSolid: brand.bg,
  panelLight: "#FFFFFF",
  border: brand.border,
  borderLight: "rgba(15, 23, 42, 0.08)",
  borderGlow: brand.borderGlow,
  accent: brand.cyan,
  accentSoft: "rgba(34, 211, 238, 0.14)",
  accentSecondary: brand.cyanSoft,
  success: "#34D399",
  warning: "#FBBF24",
  danger: "#F87171",
  shadow: "0 28px 80px rgba(0, 0, 0, 0.45)",
  shadowLight: "0 18px 50px rgba(15, 23, 42, 0.08)",
  radius: 22,
  radiusSm: 14,
  primaryOnAccent: brand.primaryOnGradient,
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
