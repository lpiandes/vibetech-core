"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { cockpitColors, spacing, typography, radius } from "@/design/tokens";
import { ActionButton } from "@/components/operating/Surface";
import { scrubInternalWording } from "@/lib/operating/businessLanguage";

export type DecisionAction = {
  id: string;
  label: string;
  href?: string | null;
  onClick?: () => void;
};

/**
 * Owner decision card — why, impact, action. Evidence optional behind expand.
 */
export default function DecisionCard({
  title,
  why,
  impact,
  timeHint,
  evidence,
  actions,
  askHref,
  priority,
  expanded: expandedProp,
  onToggleEvidence,
}: {
  title: string;
  why?: string | null;
  impact?: string | null;
  timeHint?: string | null;
  evidence?: string | null;
  actions?: DecisionAction[];
  askHref?: string | null;
  priority?: string | null;
  expanded?: boolean;
  onToggleEvidence?: () => void;
}) {
  const [localExpanded, setLocalExpanded] = useState(false);
  const expanded = expandedProp ?? localExpanded;
  const toggleEvidence = onToggleEvidence ?? (() => setLocalExpanded((value) => !value));

  return (
    <article
      style={{
        display: "grid",
        gap: spacing.sm,
        padding: spacing.lg,
        borderRadius: radius.large,
        background: cockpitColors.panel,
        boxShadow: "0 1px 2px rgba(28, 25, 23, 0.04)",
        border: priority ? "1px solid rgba(180, 83, 9, 0.28)" : "1px solid transparent",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: spacing.md, flexWrap: "wrap" }}>
        <h3 style={{ margin: 0, fontSize: typography.cardTitle.fontSize, fontWeight: 650 }}>
          {scrubInternalWording(title)}
        </h3>
        {timeHint ? (
          <span style={{ color: cockpitColors.textMuted, fontSize: typography.meta.fontSize }}>{timeHint}</span>
        ) : null}
      </div>
      {why ? (
        <p style={{ margin: 0, color: cockpitColors.textSecondary, lineHeight: 1.55 }}>
          <strong style={{ color: cockpitColors.textPrimary }}>Why: </strong>
          {scrubInternalWording(why)}
        </p>
      ) : null}
      {impact ? (
        <p style={{ margin: 0, color: cockpitColors.textSecondary, fontSize: typography.meta.fontSize }}>
          Impact: {scrubInternalWording(impact)}
        </p>
      ) : null}
      {evidence ? (
        <div>
          <button
            type="button"
            onClick={toggleEvidence}
            style={{
              border: "none",
              background: "transparent",
              color: cockpitColors.accent,
              fontWeight: 600,
              fontSize: typography.meta.fontSize,
              cursor: "pointer",
              padding: 0,
            }}
          >
            {expanded ? "Hide supporting details" : "Show supporting details"}
          </button>
          {expanded ? (
            <p style={{ margin: `${spacing.sm} 0 0`, color: cockpitColors.textMuted, fontSize: typography.meta.fontSize }}>
              {scrubInternalWording(evidence)}
            </p>
          ) : null}
        </div>
      ) : null}
      <div style={{ display: "flex", gap: spacing.sm, flexWrap: "wrap", marginTop: spacing.xs }}>
        {(actions ?? []).slice(0, 3).map((action) =>
          action.href ? (
            <ActionButton key={action.id} href={action.href} variant="primary">
              {action.label}
            </ActionButton>
          ) : (
            <ActionButton key={action.id} onClick={action.onClick} variant="secondary">
              {action.label}
            </ActionButton>
          ),
        )}
        {askHref ? (
          <ActionButton href={askHref} variant="ghost">
            Ask VIBETech
          </ActionButton>
        ) : null}
      </div>
    </article>
  );
}

export function SituationCard({
  title,
  responsible,
  current,
  next,
  related,
  href,
  steps,
}: {
  title: string;
  responsible?: string | null;
  current?: string | null;
  next?: string | null;
  related?: string | null;
  href?: string | null;
  steps?: Array<{ id: string; label: string }>;
}) {
  return (
    <article style={{ display: "grid", gap: spacing.sm, padding: `${spacing.md} 0`, borderBottom: `1px solid ${cockpitColors.panelBorder}` }}>
      <div>
        <h3 style={{ margin: 0, fontSize: typography.cardTitle.fontSize, fontWeight: 650 }}>
          {href ? (
            <Link href={href} style={{ color: "inherit", textDecoration: "none" }}>
              {scrubInternalWording(title)}
            </Link>
          ) : (
            scrubInternalWording(title)
          )}
        </h3>
        {related ? (
          <div style={{ color: cockpitColors.textMuted, fontSize: typography.meta.fontSize, marginTop: 2 }}>
            {scrubInternalWording(related)}
          </div>
        ) : null}
      </div>
      {responsible ? (
        <div style={{ color: cockpitColors.textSecondary, fontSize: typography.body.fontSize }}>
          {scrubInternalWording(responsible)}
        </div>
      ) : null}
      {steps?.length ? (
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 2 }}>
          {steps.map((step) => (
            <li key={step.id} style={{ color: cockpitColors.handled, fontSize: typography.meta.fontSize }}>
              ✓ {scrubInternalWording(step.label)}
            </li>
          ))}
        </ul>
      ) : null}
      {current ? (
        <div style={{ fontSize: typography.body.fontSize }}>
          <span style={{ color: cockpitColors.textMuted }}>Now: </span>
          {scrubInternalWording(current)}
        </div>
      ) : null}
      {next ? (
        <div style={{ fontSize: typography.body.fontSize }}>
          <span style={{ color: cockpitColors.textMuted }}>Next: </span>
          {scrubInternalWording(next)}
        </div>
      ) : null}
    </article>
  );
}

export function OutcomeCard({
  title,
  result,
  meta,
}: {
  title: string;
  result?: string | null;
  meta?: ReactNode;
}) {
  return (
    <li style={{ display: "flex", gap: spacing.sm, alignItems: "flex-start", padding: `${spacing.sm} 0` }}>
      <span style={{ color: cockpitColors.handled, fontWeight: 700 }} aria-hidden>✓</span>
      <div>
        <div style={{ fontWeight: 600 }}>{scrubInternalWording(title)}</div>
        {(result || meta) ? (
          <div style={{ color: cockpitColors.textMuted, fontSize: typography.meta.fontSize }}>
            {[result, meta].filter(Boolean).map((part, i) => (
              <span key={i}>{i > 0 ? " · " : null}{part}</span>
            ))}
          </div>
        ) : null}
      </div>
    </li>
  );
}
