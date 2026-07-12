"use client";

import OperatingStatusBadge from "@/components/operating/OperatingStatusBadge";
import { ActionButton } from "@/components/operating/Surface";
import { cockpitColors, spacing, typography, radius } from "@/design/tokens";

/**
 * Accountable worker card — humans and AI employees share the same operational shape.
 */
export default function EmployeeWorkerCard({
  name,
  role,
  status,
  responsibilities,
  currentWork,
  recentOutcome,
  needsApproval,
  blockers,
  askHref,
}: {
  name: string;
  role?: string;
  status?: string;
  responsibilities?: string[];
  currentWork?: string | null;
  recentOutcome?: string | null;
  needsApproval?: boolean;
  blockers?: string[];
  askHref?: string;
}) {
  return (
    <article
      style={{
        display: "grid",
        gap: spacing.sm,
        padding: spacing.md,
        borderBottom: `1px solid ${cockpitColors.panelBorder}`,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: spacing.sm, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontWeight: 650, color: cockpitColors.textPrimary }}>{name}</div>
          {role ? (
            <div style={{ fontSize: typography.meta.fontSize, color: cockpitColors.textMuted, marginTop: 2 }}>{role}</div>
          ) : null}
        </div>
        <OperatingStatusBadge status={status} label={status ?? "Ready"} />
      </div>
      {responsibilities?.length ? (
        <div style={{ fontSize: typography.meta.fontSize, color: cockpitColors.textSecondary }}>
          Responsibilities: {responsibilities.slice(0, 4).join(" · ")}
        </div>
      ) : null}
      {currentWork ? (
        <div style={{ fontSize: typography.body.fontSize, color: cockpitColors.textSecondary }}>
          Current work: {currentWork}
        </div>
      ) : null}
      {recentOutcome ? (
        <div style={{ fontSize: typography.meta.fontSize, color: cockpitColors.handled }}>
          Recent outcome: {recentOutcome}
        </div>
      ) : null}
      {needsApproval ? (
        <div style={{ fontSize: typography.meta.fontSize, color: cockpitColors.warning }}>Approval required</div>
      ) : null}
      {blockers?.length ? (
        <div style={{ fontSize: typography.meta.fontSize, color: cockpitColors.critical }}>
          Blocked: {blockers.join("; ")}
        </div>
      ) : null}
      {askHref ? (
        <div>
          <ActionButton href={askHref} variant="ghost">
            Ask VIBETech
          </ActionButton>
        </div>
      ) : null}
    </article>
  );
}
