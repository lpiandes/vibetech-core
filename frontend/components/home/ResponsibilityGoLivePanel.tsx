"use client";

import Link from "next/link";
import { cockpitColors, radius } from "@/design/tokens";

type GoLiveView = {
  summary?: string;
  readyCount?: number;
  total?: number;
  canOpenBusiness?: boolean;
  needsYourAction?: Array<{
    responsibilityId: string;
    title?: string;
    readinessLabel?: string;
    primaryAction?: string | null;
    shortActions?: string[];
    checklistHints?: { businessEmailConnected?: boolean; calendarConnected?: boolean };
  }>;
  vibetechWorking?: Array<{ responsibilityId: string; title?: string; readinessLabel?: string }>;
  readyForShadow?: Array<{ responsibilityId: string; title?: string }>;
  cannotInstall?: Array<{ responsibilityId: string; title?: string; shortActions?: string[] }>;
};

/**
 * Compact responsibility readiness — one title, one action. No constraint essays.
 */
export default function ResponsibilityGoLivePanel({
  businessId,
  view,
}: {
  businessId: string;
  view: GoLiveView | null;
}) {
  if (!view || !view.total) return null;
  const base = `/b/${encodeURIComponent(businessId)}`;
  const needs = view.needsYourAction ?? [];
  const working = view.vibetechWorking ?? [];
  const ready = view.readyForShadow ?? [];
  const blocked = view.cannotInstall ?? [];

  if (!needs.length && !working.length && !ready.length && !blocked.length) return null;

  return (
    <section
      aria-label="Setup next steps"
      style={{
        border: `1px solid ${cockpitColors.panelBorder}`,
        borderRadius: radius.large,
        background: cockpitColors.panel,
        padding: "16px 18px",
        display: "grid",
        gap: 12,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline" }}>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: cockpitColors.textPrimary }}>
          Next steps
        </h2>
        <span style={{ fontSize: 12, fontWeight: 650, color: cockpitColors.textMuted }}>
          {view.summary}
        </span>
      </div>

      {needs.length ? (
        <div style={{ display: "grid", gap: 8 }}>
          {needs.map((item) => {
            const action = item.primaryAction
              || item.shortActions?.[0]
              || (!item.checklistHints?.businessEmailConnected ? "Connect business email" : "Open Connections");
            return (
              <SetupRow
                key={item.responsibilityId}
                title={shortTitle(item.title)}
                action={action}
                href={`${base}/integrations`}
              />
            );
          })}
        </div>
      ) : null}

      {working.length ? (
        <QuietList
          label="VIBETech handling"
          items={working.map((item) => shortTitle(item.title))}
        />
      ) : null}

      {ready.length ? (
        <QuietList
          label="Ready"
          items={ready.map((item) => shortTitle(item.title))}
        />
      ) : null}

      {blocked.length ? (
        <QuietList
          label="Needs a different approach"
          items={blocked.map((item) => shortTitle(item.title))}
          tone="warn"
        />
      ) : null}
    </section>
  );
}

function SetupRow({
  title,
  action,
  href,
}: {
  title: string;
  action: string;
  href: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        padding: "12px 14px",
        borderRadius: radius.medium,
        border: `1px solid ${cockpitColors.panelBorder}`,
        background: cockpitColors.panelElevated ?? "rgba(15,23,42,.35)",
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 650, fontSize: 14, color: cockpitColors.textPrimary }}>
          {title}
        </div>
        <div style={{ marginTop: 2, fontSize: 12, color: cockpitColors.textSecondary }}>
          {action}
        </div>
      </div>
      <Link
        href={href}
        style={{
          flexShrink: 0,
          fontSize: 13,
          fontWeight: 700,
          color: "#22d3ee",
          textDecoration: "none",
        }}
      >
        Fix →
      </Link>
    </div>
  );
}

function QuietList({
  label,
  items,
  tone = "default",
}: {
  label: string;
  items: string[];
  tone?: "default" | "warn";
}) {
  if (!items.length) return null;
  return (
    <div style={{ display: "grid", gap: 4 }}>
      <div style={{
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "0.04em",
        textTransform: "uppercase",
        color: tone === "warn" ? (cockpitColors.warning ?? "#FBBF24") : cockpitColors.textMuted,
      }}
      >
        {label}
      </div>
      <p style={{ margin: 0, fontSize: 13, lineHeight: 1.45, color: cockpitColors.textSecondary }}>
        {items.join(" · ")}
      </p>
    </div>
  );
}

function shortTitle(title?: string) {
  const raw = String(title ?? "Responsibility").trim();
  if (raw.length <= 48) return raw;
  return `${raw.slice(0, 45).trim()}…`;
}
