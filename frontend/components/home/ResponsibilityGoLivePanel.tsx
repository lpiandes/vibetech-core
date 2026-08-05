"use client";

import Link from "next/link";
import { cockpitColors, spacing, typography, radius } from "@/design/tokens";

type GoLiveView = {
  summary?: string;
  readyCount?: number;
  total?: number;
  canOpenBusiness?: boolean;
  needsYourAction?: Array<{
    responsibilityId: string;
    title?: string;
    readinessLabel?: string;
    constraints?: Array<{ description?: string; resolutionAction?: string; owner?: string }>;
    checklistHints?: { businessEmailConnected?: boolean; calendarConnected?: boolean };
  }>;
  vibetechWorking?: Array<{ responsibilityId: string; title?: string; readinessLabel?: string }>;
  readyForShadow?: Array<{ responsibilityId: string; title?: string }>;
  cannotInstall?: Array<{ responsibilityId: string; title?: string; constraints?: Array<{ description?: string }> }>;
};

/**
 * Responsibility-scoped Go Live — preserves RFT path elsewhere; this surfaces
 * per-responsibility constraints with customer / VIBETech ownership.
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

  return (
    <section
      style={{
        border: `1px solid ${cockpitColors.panelBorder}`,
        borderRadius: radius.lg,
        background: cockpitColors.panel,
        padding: spacing.lg,
        display: "grid",
        gap: spacing.md,
      }}
    >
      <div>
        <div style={{ ...typography.label, color: cockpitColors.textSecondary, marginBottom: 6 }}>
          Finish setup to begin operating
        </div>
        <h2 style={{ margin: 0, ...typography.h3, color: cockpitColors.textPrimary }}>
          {view.summary}
        </h2>
        <p style={{ margin: "8px 0 0", color: cockpitColors.textSecondary, fontSize: 13, lineHeight: 1.45 }}>
          The business can open when at least one responsibility is safe. Blocked responsibilities stay honest — they do not halt everything else.
          {view.canOpenBusiness ? " Partial readiness is OK." : ""}
        </p>
      </div>

      {(view.needsYourAction ?? []).length > 0 ? (
        <Bucket title="Needs your action">
          {(view.needsYourAction ?? []).map((item) => (
            <Card key={item.responsibilityId} title={item.title} label={item.readinessLabel}>
              <ul style={{ margin: "8px 0 0", paddingLeft: 18, color: cockpitColors.textSecondary, fontSize: 13 }}>
                {(item.constraints ?? []).slice(0, 4).map((c, i) => (
                  <li key={`${item.responsibilityId}_${i}`}>
                    {c.description}
                    {c.resolutionAction ? ` — ${c.resolutionAction}` : ""}
                  </li>
                ))}
              </ul>
              <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 8 }}>
                <Link href={`${base}/integrations`} style={linkStyle}>Open Integrations</Link>
                {item.checklistHints?.businessEmailConnected === false ? (
                  <span style={hintStyle}>Business email not connected</span>
                ) : null}
                {item.checklistHints?.calendarConnected === false ? (
                  <span style={hintStyle}>Calendar not connected</span>
                ) : null}
              </div>
            </Card>
          ))}
        </Bucket>
      ) : null}

      {(view.vibetechWorking ?? []).length > 0 ? (
        <Bucket title="VIBETech is working">
          {(view.vibetechWorking ?? []).map((item) => (
            <Card key={item.responsibilityId} title={item.title} label={item.readinessLabel} />
          ))}
        </Bucket>
      ) : null}

      {(view.readyForShadow ?? []).length > 0 ? (
        <Bucket title="Ready for shadow">
          {(view.readyForShadow ?? []).map((item) => (
            <Card key={item.responsibilityId} title={item.title} label="All required access and rules present" />
          ))}
        </Bucket>
      ) : null}

      {(view.cannotInstall ?? []).length > 0 ? (
        <Bucket title="Cannot be installed as requested">
          {(view.cannotInstall ?? []).map((item) => (
            <Card key={item.responsibilityId} title={item.title} label="Unsupported or unsafe">
              <ul style={{ margin: "8px 0 0", paddingLeft: 18, color: cockpitColors.textSecondary, fontSize: 13 }}>
                {(item.constraints ?? []).slice(0, 3).map((c, i) => (
                  <li key={`${item.responsibilityId}_x_${i}`}>{c.description}</li>
                ))}
              </ul>
            </Card>
          ))}
        </Bucket>
      ) : null}
    </section>
  );
}

function Bucket({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div style={{ ...typography.label, color: cockpitColors.textMuted, letterSpacing: "0.06em" }}>
        {title.toUpperCase()}
      </div>
      {children}
    </div>
  );
}

function Card({
  title,
  label,
  children,
}: {
  title?: string;
  label?: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      style={{
        border: `1px solid ${cockpitColors.panelBorder}`,
        borderRadius: radius.md,
        padding: spacing.md,
        background: cockpitColors.panelElevated,
      }}
    >
      <div style={{ fontWeight: 700, color: cockpitColors.textPrimary }}>{title}</div>
      {label ? (
        <div style={{ marginTop: 4, fontSize: 12, color: cockpitColors.textSecondary }}>{label}</div>
      ) : null}
      {children}
    </div>
  );
}

const linkStyle = {
  fontSize: 13,
  fontWeight: 700,
  color: cockpitColors.accent ?? "#14B8A6",
  textDecoration: "none" as const,
};

const hintStyle = {
  fontSize: 12,
  color: cockpitColors.warning ?? "#FBBF24",
};
