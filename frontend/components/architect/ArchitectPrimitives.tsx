import type { CSSProperties, ReactNode } from "react";
import { architect } from "./architectTheme";

export function ArchitectShell({
  children,
  light = false,
  maxWidth = 1280,
}: {
  children: ReactNode;
  light?: boolean;
  maxWidth?: number;
}) {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: light ? architect.bgLight : architect.bg,
        color: light ? architect.inkDark : architect.ink,
        fontFamily: architect.font,
      }}
    >
      <style>{`
        @keyframes architectFadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes architectPulse { 0%,100%{opacity:.4} 50%{opacity:1} }
        @keyframes architectShimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
        @keyframes architectSpin { to { transform: rotate(360deg); } }
        .architect-workspace-grid {
          display: grid;
          grid-template-columns: minmax(300px, 1fr) minmax(420px, 1.4fr) minmax(240px, 0.85fr);
          gap: 16px;
        }
        @media (max-width: 1100px) {
          .architect-workspace-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
      <div style={{ maxWidth, margin: "0 auto", padding: "32px 24px 64px", animation: "architectFadeUp .5s ease" }}>
        {children}
      </div>
    </div>
  );
}

export function ArchitectPanel({
  children,
  light = false,
  style,
}: {
  children: ReactNode;
  light?: boolean;
  style?: CSSProperties;
}) {
  return (
    <div
      style={{
        background: light ? architect.panelLight : architect.panel,
        border: `1px solid ${light ? architect.borderLight : architect.border}`,
        borderRadius: architect.radius,
        boxShadow: light ? architect.shadowLight : architect.shadow,
        backdropFilter: light ? undefined : "blur(18px)",
        padding: 24,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function ArchitectButton({
  children,
  onClick,
  disabled,
  variant = "primary",
  accent = architect.accent,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "primary" | "ghost" | "secondary";
  accent?: string;
}) {
  const base: CSSProperties = {
    borderRadius: 999,
    padding: "11px 18px",
    fontWeight: 650,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.55 : 1,
    border: "none",
    transition: "transform .15s ease, background .15s ease",
  };
  const styles: Record<string, CSSProperties> = {
    primary: { ...base, background: accent, color: "#042F2E" },
    secondary: {
      ...base,
      background: "transparent",
      color: architect.ink,
      border: `1px solid ${architect.border}`,
    },
    ghost: {
      ...base,
      background: architect.accentSoft,
      color: accent,
    },
  };
  return (
    <button type="button" disabled={disabled} onClick={onClick} style={styles[variant]}>
      {children}
    </button>
  );
}

export function ArchitectBadge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "success" | "warning" | "accent";
}) {
  const map = {
    neutral: { bg: "rgba(148,163,184,.16)", color: "#E2E8F0" },
    success: { bg: "rgba(52,211,153,.16)", color: architect.success },
    warning: { bg: "rgba(251,191,36,.16)", color: architect.warning },
    accent: { bg: architect.accentSoft, color: architect.accent },
  }[tone];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        borderRadius: 999,
        padding: "4px 10px",
        fontSize: 12,
        fontWeight: 650,
        background: map.bg,
        color: map.color,
      }}
    >
      {children}
    </span>
  );
}

export function ArchitectSkeleton({ height = 16, width = "100%" }: { height?: number; width?: string | number }) {
  return (
    <div
      style={{
        height,
        width,
        borderRadius: 10,
        background: "linear-gradient(90deg, rgba(148,163,184,.12), rgba(148,163,184,.28), rgba(148,163,184,.12))",
        backgroundSize: "200% 100%",
        animation: "architectShimmer 1.4s linear infinite",
      }}
    />
  );
}

export function ThinkingDots({ label = "Architect is thinking" }: { label?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, color: architect.inkMuted, fontSize: 14 }}>
      <span
        style={{
          width: 14,
          height: 14,
          borderRadius: "50%",
          border: `2px solid ${architect.accent}`,
          borderTopColor: "transparent",
          animation: "architectSpin .8s linear infinite",
        }}
      />
      <span style={{ animation: "architectPulse 1.4s ease infinite" }}>{label}</span>
    </div>
  );
}
