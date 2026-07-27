"use client";

import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";

import { cockpitColors, spacing } from "@/design/tokens";

/** Full-bleed mission surface — shared by Calendar, People, Pipelines, Automations, Specialty. */
export function VtPage({
  children,
  maxWidth = 1440,
}: {
  children: ReactNode;
  maxWidth?: number | "none";
}) {
  return (
    <div
      style={{
        width: "100%",
        maxWidth: maxWidth === "none" ? undefined : maxWidth,
        margin: "0 auto",
        display: "grid",
        gap: 18,
        paddingBottom: 32,
      }}
    >
      {children}
    </div>
  );
}

export function VtStatusChip({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: "live" | "warn" | "off" | "neutral";
}) {
  const bg =
    tone === "live" ? "rgba(16,185,129,0.35)"
      : tone === "warn" ? "rgba(245,158,11,0.4)"
        : tone === "off" ? "rgba(120,113,108,0.45)"
          : "rgba(255,255,255,0.18)";
  return (
    <span
      style={{
        fontSize: 12,
        fontWeight: 900,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        padding: "8px 12px",
        borderRadius: 999,
        background: bg,
        border: "2px solid rgba(255,255,255,0.35)",
        color: "#fff",
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}

export function VtDock({ children }: { children: ReactNode }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>{children}</div>
  );
}

export function VtDockLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "10px 14px",
        borderRadius: 12,
        border: "2px solid rgba(255,255,255,0.4)",
        background: "rgba(0,0,0,0.35)",
        color: "#fff",
        textDecoration: "none",
        fontSize: 13,
        fontWeight: 900,
        letterSpacing: "0.04em",
        textTransform: "uppercase",
        boxShadow: "0 4px 12px rgba(0,0,0,0.25)",
      }}
    >
      {children}
    </Link>
  );
}

export function VtDockButton({
  onClick,
  children,
  active = false,
}: {
  onClick: () => void;
  children: ReactNode;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "10px 14px",
        borderRadius: 12,
        border: active ? "2px solid #5eead4" : "2px solid rgba(255,255,255,0.4)",
        background: active ? "rgba(15,118,110,0.85)" : "rgba(0,0,0,0.35)",
        color: "#fff",
        fontSize: 13,
        fontWeight: 900,
        letterSpacing: "0.04em",
        textTransform: "uppercase",
        cursor: "pointer",
        boxShadow: "0 4px 12px rgba(0,0,0,0.25)",
      }}
    >
      {children}
    </button>
  );
}

export function VtCard({
  children,
  style,
  padding = 16,
  accent = false,
  onClick,
}: {
  children: ReactNode;
  style?: CSSProperties;
  padding?: number;
  accent?: boolean;
  onClick?: () => void;
}) {
  const Tag = onClick ? "button" : "section";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      style={{
        borderRadius: 16,
        border: `2px solid ${accent ? "rgba(15,118,110,0.45)" : "rgba(28,25,23,0.16)"}`,
        background: accent
          ? "linear-gradient(165deg, #ffffff 0%, #ecfdf5 100%)"
          : "#ffffff",
        padding,
        boxShadow: "0 1px 0 rgba(255,255,255,0.9) inset, 0 10px 28px rgba(28,25,23,0.1)",
        position: "relative",
        overflow: "hidden",
        textAlign: "left",
        cursor: onClick ? "pointer" : undefined,
        font: "inherit",
        width: onClick ? "100%" : undefined,
        ...style,
      }}
    >
      <span
        aria-hidden
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: 5,
          background: `linear-gradient(180deg, ${cockpitColors.accent}, #134e4a)`,
          opacity: accent ? 1 : 0.7,
        }}
      />
      {children}
    </Tag>
  );
}

export function VtPanel({
  title,
  right,
  children,
  style,
}: {
  title: string;
  right?: ReactNode;
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <VtCard style={style} padding={16}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          alignItems: "center",
          marginBottom: 14,
          paddingBottom: 10,
          borderBottom: `2px solid ${cockpitColors.inset}`,
        }}
      >
        <h2
          style={{
            margin: 0,
            fontSize: 14,
            fontWeight: 900,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: cockpitColors.textPrimary,
          }}
        >
          {title}
        </h2>
        {right}
      </div>
      <div style={{ display: "grid", gap: 12 }}>{children}</div>
    </VtCard>
  );
}

export function VtHero({
  eyebrow,
  title,
  right,
  children,
}: {
  eyebrow?: string;
  title: ReactNode;
  right?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header
      style={{
        borderRadius: 18,
        border: "2px solid rgba(45,212,191,0.55)",
        background: "linear-gradient(135deg, #0f766e 0%, #115e59 42%, #1c1917 100%)",
        color: "#fff",
        padding: "18px 20px",
        display: "grid",
        gap: 14,
        boxShadow: "0 16px 44px rgba(15,118,110,0.28), inset 0 1px 0 rgba(255,255,255,0.14)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <span
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse at 12% 0%, rgba(45,212,191,0.32), transparent 55%), radial-gradient(ellipse at 100% 100%, rgba(0,0,0,0.4), transparent 50%)",
          pointerEvents: "none",
        }}
      />
      <div style={{ position: "relative", display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
        <div>
          {eyebrow ? (
            <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: "0.12em", textTransform: "uppercase", opacity: 0.8 }}>
              {eyebrow}
            </div>
          ) : null}
          <h1 style={{ margin: "6px 0 0", fontSize: "1.85rem", fontWeight: 900, letterSpacing: "-0.03em", lineHeight: 1.1 }}>
            {title}
          </h1>
        </div>
        {right}
      </div>
      {children ? <div style={{ position: "relative" }}>{children}</div> : null}
    </header>
  );
}

export function VtActiveToggle({
  active,
  busy,
  onClick,
  activeLabel = "ACTIVE",
  inactiveLabel = "OFF",
}: {
  active: boolean;
  busy?: boolean;
  onClick: () => void;
  activeLabel?: string;
  inactiveLabel?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      aria-pressed={active}
      style={{
        minWidth: 88,
        padding: "8px 14px",
        borderRadius: 999,
        border: active
          ? `1.5px solid ${cockpitColors.accent}`
          : `1.5px solid ${cockpitColors.panelBorder}`,
        background: active ? cockpitColors.accent : "#fff",
        color: active ? "#fff" : cockpitColors.textMuted,
        fontWeight: 800,
        fontSize: 12,
        letterSpacing: "0.06em",
        cursor: busy ? "wait" : "pointer",
        boxShadow: "none",
      }}
    >
      {busy ? "…" : active ? activeLabel : inactiveLabel}
    </button>
  );
}

export function VtMetricStrip({
  items,
}: {
  items: Array<{ label: string; value: string | number; hint?: string }>;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${Math.min(items.length, 4)}, minmax(0, 1fr))`,
        gap: 12,
      }}
      className="vt-metric-strip"
    >
      {items.map((item) => (
        <VtCard key={item.label} padding={14} accent>
          <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: "0.08em", textTransform: "uppercase", color: cockpitColors.textMuted }}>
            {item.label}
          </div>
          <div style={{ fontSize: 28, fontWeight: 900, color: cockpitColors.textPrimary, marginTop: 4, letterSpacing: "-0.03em" }}>
            {item.value}
          </div>
          {item.hint ? (
            <div style={{ fontSize: 13, color: cockpitColors.textSecondary, marginTop: 4 }}>{item.hint}</div>
          ) : null}
        </VtCard>
      ))}
    </div>
  );
}

export function VtEmpty({ label }: { label: string }) {
  return (
    <div
      style={{
        padding: "24px 16px",
        textAlign: "center",
        borderRadius: 12,
        border: `2px dashed rgba(28,25,23,0.22)`,
        background: cockpitColors.inset,
        color: cockpitColors.textSecondary,
        fontSize: 14,
        fontWeight: 800,
      }}
    >
      {label}
    </div>
  );
}

export function VtFilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        borderRadius: 999,
        border: active ? `3px solid #0f766e` : `2px solid rgba(28,25,23,0.22)`,
        padding: "9px 14px",
        fontWeight: 900,
        fontSize: 12,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        background: active
          ? "linear-gradient(180deg, #0f766e 0%, #115e59 100%)"
          : "#fff",
        color: active ? "#fff" : cockpitColors.textPrimary,
        cursor: "pointer",
        boxShadow: active
          ? "0 6px 16px rgba(15,118,110,0.35)"
          : "0 2px 8px rgba(28,25,23,0.08)",
      }}
    >
      {children}
    </button>
  );
}

export const vtInputStyle: CSSProperties = {
  width: "100%",
  borderRadius: 12,
  border: `2px solid rgba(28,25,23,0.18)`,
  padding: "12px 14px",
  font: "inherit",
  fontSize: 15,
  background: "#fff",
  fontWeight: 600,
  color: cockpitColors.textPrimary,
};

export const vtGridGap = spacing.md;
