"use client";

import Link from "next/link";

import ExecutiveCard from "@/components/executive/ExecutiveCard";
import ExecutiveHeader from "@/components/executive/ExecutiveHeader";
import ExecutiveStack from "@/components/executive/ExecutiveStack";
import ExecutiveEmptyState from "@/components/executive/ExecutiveEmptyState";
import StatusPill from "@/components/executive/StatusPill";

import type { AudienceDashboardViewModel, AudienceSummaryViewModel } from "@/lib/workspace/AudienceTypes";
import { semanticColors, spacing, typography } from "@/design/tokens";

export default function AudienceDetail({
  dashboard,
  audience,
  segmentId,
}: {
  dashboard: AudienceDashboardViewModel;
  audience: AudienceSummaryViewModel | null;
  segmentId: string;
}) {
  if (!audience) {
    return (
      <ExecutiveEmptyState
        title="Audience not found"
        message={`No audience with id "${segmentId}" exists in this workspace.`}
      />
    );
  }

  return (
    <ExecutiveStack gap="xl">
      <div>
        <Link href="/audiences" style={{ color: semanticColors.accent, fontSize: typography.caption.fontSize }}>
          ← All audiences
        </Link>
      </div>

      <ExecutiveHeader title={audience.segmentName} subtitle={audience.purpose} />

      <ExecutiveCard>
        <div style={{ display: "flex", gap: spacing.lg, flexWrap: "wrap" }}>
          <Metric label="Members" value={String(audience.memberCount)} />
          <Metric label="Contactable" value={String(audience.contactableCount)} />
          <Metric label="Blocked" value={String(audience.blockedCount)} />
        </div>
      </ExecutiveCard>

      {audience.members.length === 0 ? (
        <ExecutiveEmptyState title="No members yet" message="Members appear when people match this audience's criteria." />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: spacing.md }}>
          {audience.members.map((member) => (
            <ExecutiveCard key={member.partyId}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: spacing.md, alignItems: "flex-start" }}>
                <div>
                  <Link
                    href={`/engagement/${member.partyId}`}
                    style={{ color: semanticColors.textPrimary, textDecoration: "none", fontWeight: 600 }}
                  >
                    {member.displayName}
                  </Link>
                  <div style={{ marginTop: spacing.sm, color: semanticColors.textSecondary, fontSize: typography.caption.fontSize }}>
                    Matched because: {member.matchReasons.length > 0 ? member.matchReasons.join("; ") : "criteria satisfied"}
                  </div>
                  <div style={{ marginTop: spacing.xs, color: semanticColors.textMuted, fontSize: typography.caption.fontSize }}>
                    Email: {member.contactability.email} · SMS: {member.contactability.sms}
                  </div>
                </div>
                {member.contactability.contactable ? (
                  <StatusPill tone="success" label="Contactable" />
                ) : (
                  <StatusPill tone="warning" label="Blocked" />
                )}
              </div>
            </ExecutiveCard>
          ))}
        </div>
      )}
    </ExecutiveStack>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ color: semanticColors.textMuted, fontSize: typography.caption.fontSize }}>{label}</div>
      <div style={{ fontWeight: 600, fontSize: typography.pageTitle.fontSize }}>{value}</div>
    </div>
  );
}
