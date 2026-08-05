/**
 * Shared simple UI primitives — same look on every screen.
 */
import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";

import { cockpitColors, radius, spacing } from "@/design/tokens";

export const simplePageStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 20,
  paddingBottom: spacing.xl,
  maxWidth: 920,
};

export const simplePanelStyle: CSSProperties = {
  borderRadius: 16,
  border: "1px solid rgba(15,23,42,.08)",
  background: "#fff",
  overflow: "hidden",
};

export function NextBanner({
  label,
  href,
  onClick,
  actionLabel = "Go →",
}: {
  label: string;
  href?: string;
  onClick?: () => void;
  actionLabel?: string;
}) {
  const style: CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    padding: "18px 20px",
    borderRadius: 18,
    background: "linear-gradient(120deg, #22d3ee 0%, #38bdf8 40%, #a855f7 100%)",
    color: "#0f172a",
    textDecoration: "none",
    fontWeight: 800,
    fontSize: 17,
    border: "none",
    cursor: "pointer",
    width: "100%",
    textAlign: "left",
  };
  if (href) {
    return (
      <Link href={href} style={style}>
        <span>Next: {label}</span>
        <span style={{ opacity: 0.9 }}>{actionLabel}</span>
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} style={style}>
      <span>Next: {label}</span>
      <span style={{ opacity: 0.9 }}>{actionLabel}</span>
    </button>
  );
}

export function SimpleEmpty({ children = "Nothing here yet." }: { children?: ReactNode }) {
  return (
    <div style={{ padding: "28px 20px", color: cockpitColors.textMuted, fontSize: 15, fontWeight: 600 }}>
      {children}
    </div>
  );
}

/** Compact empty copy for dense dashboard panels — not a tall placeholder block. */
export function SimpleEmptyLine({ children }: { children: ReactNode }) {
  return (
    <div style={{ padding: "14px 18px", color: cockpitColors.textMuted, fontSize: 14, fontWeight: 600, lineHeight: 1.45 }}>
      {children}
    </div>
  );
}

export function SimplePanel({
  title,
  action,
  count,
  children,
}: {
  title?: string;
  action?: ReactNode;
  count?: number | null;
  children: ReactNode;
}) {
  return (
    <section style={simplePanelStyle}>
      {title ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            padding: "14px 18px",
            borderBottom: "1px solid rgba(15,23,42,.06)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: 15, color: cockpitColors.textPrimary }}>{title}</div>
            {typeof count === "number" && count > 0 ? (
              <span
                style={{
                  minWidth: 22,
                  height: 22,
                  padding: "0 7px",
                  borderRadius: radius.pill,
                  background: cockpitColors.inset,
                  color: cockpitColors.textSecondary,
                  fontSize: 11,
                  fontWeight: 750,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {count > 99 ? "99+" : count}
              </span>
            ) : null}
          </div>
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function SimplePanelLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      style={{
        color: cockpitColors.accent,
        fontWeight: 700,
        fontSize: 13,
        textDecoration: "none",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </Link>
  );
}

export function SimpleRow({
  title,
  meta,
  trailing,
  href,
  leading,
}: {
  title: string;
  meta?: string | null;
  trailing?: ReactNode;
  href?: string | null;
  leading?: ReactNode;
}) {
  const body = (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "14px 18px",
        borderBottom: "1px solid rgba(15,23,42,.06)",
        textDecoration: "none",
        color: "inherit",
      }}
    >
      {leading}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 15, color: cockpitColors.textPrimary }}>{title}</div>
        {meta ? (
          <div style={{ marginTop: 2, fontSize: 13, color: cockpitColors.textMuted }}>{meta}</div>
        ) : null}
      </div>
      {trailing}
    </div>
  );
  if (href) {
    return (
      <Link
        href={href}
        style={{ textDecoration: "none", color: "inherit", display: "block" }}
        className="vt-simple-row-link"
      >
        {body}
      </Link>
    );
  }
  return body;
}

export function SimpleMetrics({
  items,
  maxColumns = 4,
}: {
  items: Array<{ id: string; label: string; value: string | number }>;
  maxColumns?: number;
}) {
  if (!items.length) return null;
  const columns = Math.min(items.length, maxColumns);
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
        gap: 10,
      }}
    >
      {items.map((item) => (
        <div
          key={item.id}
          style={{
            ...simplePanelStyle,
            padding: "14px 16px",
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 700, color: cockpitColors.textMuted }}>{item.label}</div>
          <div style={{ marginTop: 4, fontSize: 22, fontWeight: 800, color: cockpitColors.textPrimary }}>{item.value}</div>
        </div>
      ))}
    </div>
  );
}
