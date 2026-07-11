"use client";

import type { CSSProperties, ReactNode } from "react";
import { cockpitColors, spacing, typography, radius } from "@/design/tokens";
import { applyUniversalTerminology, canRenderUniversalComponent } from "@/lib/universal-components/registry.js";

export type UniversalChromeProps = {
  title?: string;
  subtitle?: string;
  terminology?: Record<string, any> | null;
  terminologyKey?: string | null;
  permission?: string | null;
  permissions?: string[] | Set<string>;
  loading?: boolean;
  error?: string | null;
  empty?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  dark?: boolean;
  compact?: boolean;
  action?: ReactNode;
  children?: ReactNode;
  componentType?: string;
  "aria-label"?: string;
};

export function useUniversalAccess(props: UniversalChromeProps) {
  const permissions = props.permissions ?? [];
  if (props.componentType && !canRenderUniversalComponent(props.componentType, permissions as any)) {
    return { allowed: false, reason: "permission_denied" as const };
  }
  if (props.permission) {
    const set = permissions instanceof Set ? permissions : new Set(permissions);
    if (!set.has(props.permission)) return { allowed: false, reason: "permission_denied" as const };
  }
  return { allowed: true, reason: null };
}

export function resolveTitle(props: UniversalChromeProps, fallback = "") {
  const raw = props.title ?? fallback;
  return applyUniversalTerminology(raw, props.terminology as any, (props.terminologyKey ?? null) as any);
}

/** Shared premium panel chrome — Linear/Stripe inspired. */
export function UcPanel({
  title,
  subtitle,
  action,
  children,
  dark = false,
  compact = false,
  style,
  "aria-label": ariaLabel,
}: {
  title?: string;
  subtitle?: string;
  action?: ReactNode;
  children?: ReactNode;
  dark?: boolean;
  compact?: boolean;
  style?: CSSProperties;
  "aria-label"?: string;
}) {
  return (
    <section
      aria-label={ariaLabel ?? title}
      style={{
        ...panelStyle(dark),
        padding: compact ? spacing.md : spacing.lg,
        ...style,
      }}
    >
      {(title || action) ? (
        <header style={{
          display: "flex",
          justifyContent: "space-between",
          gap: spacing.md,
          alignItems: "flex-start",
          marginBottom: compact ? spacing.sm : spacing.md,
        }}>
          <div style={{ minWidth: 0 }}>
            {title ? (
              <h3 style={{
                margin: 0,
                fontSize: compact ? typography.body.fontSize : "1.05rem",
                fontWeight: 650,
                letterSpacing: "-0.01em",
                color: dark ? "#F8FAFC" : cockpitColors.textPrimary,
              }}>
                {title}
              </h3>
            ) : null}
            {subtitle ? (
              <p style={{
                margin: `${spacing.xs} 0 0`,
                color: dark ? "rgba(226,232,240,.62)" : cockpitColors.textMuted,
                fontSize: typography.caption.fontSize,
                lineHeight: 1.45,
              }}>
                {subtitle}
              </p>
            ) : null}
          </div>
          {action ? <div style={{ flexShrink: 0 }}>{action}</div> : null}
        </header>
      ) : null}
      {children}
    </section>
  );
}

/** Host that enforces permission + loading/empty/error states. */
export function UcHost(props: UniversalChromeProps & { children: ReactNode }) {
  const access = useUniversalAccess(props);
  const title = resolveTitle(props);

  if (!access.allowed) {
    return (
      <UcPanel title={title || "Restricted"} dark={props.dark} compact={props.compact}>
        <UcState
          kind="error"
          title="Access restricted"
          description="You do not have permission to view this component."
          dark={props.dark}
        />
      </UcPanel>
    );
  }

  if (props.loading) {
    return (
      <UcPanel title={title} dark={props.dark} compact={props.compact} action={props.action}>
        <UcSkeleton rows={props.compact ? 2 : 4} dark={props.dark} />
      </UcPanel>
    );
  }

  if (props.error) {
    return (
      <UcPanel title={title} dark={props.dark} compact={props.compact}>
        <UcState kind="error" title="Something went wrong" description={props.error} dark={props.dark} />
      </UcPanel>
    );
  }

  if (props.empty) {
    return (
      <UcPanel title={title} dark={props.dark} compact={props.compact} action={props.action}>
        <UcState
          kind="empty"
          title={props.emptyTitle ?? "Nothing here yet"}
          description={props.emptyDescription ?? "Add the first item to get started."}
          dark={props.dark}
        />
      </UcPanel>
    );
  }

  return (
    <UcPanel
      title={title}
      subtitle={props.subtitle}
      dark={props.dark}
      compact={props.compact}
      action={props.action}
      aria-label={props["aria-label"]}
    >
      {props.children}
    </UcPanel>
  );
}

export function UcState({
  kind,
  title,
  description,
  dark = false,
}: {
  kind: "empty" | "error" | "loading";
  title: string;
  description: string;
  dark?: boolean;
}) {
  const tone = kind === "error"
    ? (dark ? "#FCA5A5" : cockpitColors.warning)
    : (dark ? "rgba(226,232,240,.62)" : cockpitColors.textMuted);
  return (
    <div role={kind === "error" ? "alert" : "status"} style={{ padding: `${spacing.md} 0`, textAlign: "left" }}>
      <div style={{ fontWeight: 650, color: dark ? "#F8FAFC" : cockpitColors.textPrimary, marginBottom: 6 }}>{title}</div>
      <div style={{ color: tone, fontSize: typography.body.fontSize, lineHeight: 1.5 }}>{description}</div>
    </div>
  );
}

export function UcSkeleton({ rows = 3, dark = false }: { rows?: number; dark?: boolean }) {
  return (
    <div aria-busy="true" aria-label="Loading" style={{ display: "grid", gap: 10 }}>
      {Array.from({ length: rows }).map((_, index) => (
        <div
          key={index}
          style={{
            height: index === 0 ? 18 : 44,
            borderRadius: radius.medium,
            background: dark
              ? "linear-gradient(90deg, rgba(148,163,184,.12), rgba(148,163,184,.24), rgba(148,163,184,.12))"
              : "linear-gradient(90deg, #EEF2F7, #F8FAFC, #EEF2F7)",
            backgroundSize: "200% 100%",
            animation: "ucShimmer 1.4s linear infinite",
          }}
        />
      ))}
      <style>{`@keyframes ucShimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }`}</style>
    </div>
  );
}

export function UcBadge({
  children,
  tone = "neutral",
  dark = false,
}: {
  children: ReactNode;
  tone?: "neutral" | "success" | "warning" | "danger" | "accent";
  dark?: boolean;
}) {
  const colors = {
    neutral: dark ? { bg: "rgba(148,163,184,.16)", color: "#E2E8F0" } : { bg: "#F1F5F9", color: "#334155" },
    success: { bg: "rgba(16,185,129,.14)", color: dark ? "#6EE7B7" : "#047857" },
    warning: { bg: "rgba(245,158,11,.16)", color: dark ? "#FCD34D" : "#B45309" },
    danger: { bg: "rgba(239,68,68,.16)", color: dark ? "#FCA5A5" : "#B91C1C" },
    accent: { bg: "rgba(15,118,110,.14)", color: dark ? "#5EEAD4" : "#0F766E" },
  }[tone];
  return (
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      borderRadius: 999,
      padding: "3px 9px",
      fontSize: 12,
      fontWeight: 650,
      background: colors.bg,
      color: colors.color,
    }}>
      {children}
    </span>
  );
}

export function UcRow({
  title,
  detail,
  meta,
  href,
  dark = false,
  leading,
}: {
  title: string;
  detail?: string;
  meta?: ReactNode;
  href?: string | null;
  dark?: boolean;
  leading?: ReactNode;
}) {
  const body = (
    <div style={{
      display: "flex",
      gap: spacing.sm,
      alignItems: "flex-start",
      padding: `${spacing.sm} 0`,
      borderBottom: `1px solid ${dark ? "rgba(148,163,184,.14)" : cockpitColors.panelBorder}`,
    }}>
      {leading}
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontWeight: 600, color: dark ? "#F8FAFC" : cockpitColors.textPrimary }}>{title}</div>
        {detail ? (
          <div style={{
            marginTop: 2,
            fontSize: typography.caption.fontSize,
            color: dark ? "rgba(226,232,240,.62)" : cockpitColors.textMuted,
            lineHeight: 1.45,
          }}>
            {detail}
          </div>
        ) : null}
      </div>
      {meta}
    </div>
  );
  if (href) {
    return <a href={href} style={{ textDecoration: "none", color: "inherit" }}>{body}</a>;
  }
  return body;
}

export function UcGrid({ children, min = 180 }: { children: ReactNode; min?: number }) {
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: `repeat(auto-fit, minmax(${min}px, 1fr))`,
      gap: spacing.md,
    }}>
      {children}
    </div>
  );
}

function panelStyle(dark: boolean): CSSProperties {
  return {
    borderRadius: 16,
    border: `1px solid ${dark ? "rgba(148,163,184,.16)" : cockpitColors.panelBorder}`,
    background: dark
      ? "linear-gradient(180deg, rgba(30,41,59,.92), rgba(15,23,42,.92))"
      : cockpitColors.panel,
    boxShadow: dark ? "0 18px 50px rgba(0,0,0,.28)" : "0 10px 30px rgba(15,23,42,.04)",
  };
}
