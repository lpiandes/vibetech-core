"use client";

import OperatingStatusBadge from "@/components/operating/OperatingStatusBadge";
import { ActionButton } from "@/components/operating/Surface";
import { cockpitColors, spacing, typography } from "@/design/tokens";
import { scrubInternalWording } from "@/lib/operating/businessLanguage";

/**
 * Coworker-style AI / human employee card — assignment narrative, not configuration.
 */
export default function EmployeeWorkerCard({
  name,
  role,
  status,
  responsibilities,
  currentWork,
  currentCustomer,
  waitingFor,
  nextAction,
  recentOutcome,
  needsApproval,
  blockers,
  confidence,
  askHref,
}: {
  name: string;
  role?: string;
  status?: string;
  responsibilities?: string[];
  currentWork?: string | null;
  currentCustomer?: string | null;
  waitingFor?: string | null;
  nextAction?: string | null;
  recentOutcome?: string | null;
  needsApproval?: boolean;
  blockers?: string[];
  confidence?: string | null;
  askHref?: string;
}) {
  const statusLabel = scrubInternalWording(status ?? "Standing by");

  return (
    <article
      style={{
        display: "grid",
        gap: spacing.sm,
        padding: spacing.lg,
        borderBottom: `1px solid ${cockpitColors.panelBorder}`,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: spacing.sm, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontWeight: 650, fontSize: typography.cardTitle.fontSize, color: cockpitColors.textPrimary }}>
            {name}
          </div>
          {role ? (
            <div style={{ fontSize: typography.meta.fontSize, color: cockpitColors.textMuted, marginTop: 2 }}>
              {scrubInternalWording(role)}
            </div>
          ) : null}
        </div>
        <OperatingStatusBadge status={status} label={statusLabel} />
      </div>

      {currentWork ? (
        <Field label="Working on" value={currentWork} />
      ) : null}
      {currentCustomer ? (
        <Field label="With" value={currentCustomer} />
      ) : null}
      {waitingFor ? (
        <Field label="Waiting for" value={waitingFor} />
      ) : null}
      {nextAction ? (
        <Field label="Next" value={nextAction} />
      ) : null}
      {recentOutcome ? (
        <Field label="Last completed" value={recentOutcome} muted />
      ) : null}
      {confidence ? (
        <Field label="Confidence" value={confidence} muted />
      ) : null}
      {needsApproval ? (
        <div style={{ fontSize: typography.meta.fontSize, color: cockpitColors.warning, fontWeight: 600 }}>
          Needs your approval to continue
        </div>
      ) : null}
      {blockers?.length ? (
        <div style={{ fontSize: typography.meta.fontSize, color: cockpitColors.critical }}>
          Blocked: {blockers.map((b) => scrubInternalWording(b)).join("; ")}
        </div>
      ) : null}
      {responsibilities?.length && !currentWork ? (
        <div style={{ fontSize: typography.meta.fontSize, color: cockpitColors.textMuted }}>
          Focus: {responsibilities.slice(0, 3).map((r) => scrubInternalWording(r)).join(" · ")}
        </div>
      ) : null}
      {askHref ? (
        <div>
          <ActionButton href={askHref} variant="ghost">
            View contract
          </ActionButton>
        </div>
      ) : null}
    </article>
  );
}

function Field({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div style={{ fontSize: typography.body.fontSize, color: muted ? cockpitColors.textMuted : cockpitColors.textSecondary }}>
      <span style={{ color: cockpitColors.textMuted }}>{label}: </span>
      {scrubInternalWording(value)}
    </div>
  );
}
