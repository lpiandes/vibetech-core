"use client";

import Link from "next/link";

import ExecutiveCard from "@/components/executive/ExecutiveCard";
import ExecutiveHeader from "@/components/executive/ExecutiveHeader";
import ExecutiveStack from "@/components/executive/ExecutiveStack";
import ExecutiveEmptyState from "@/components/executive/ExecutiveEmptyState";
import StatusPill from "@/components/executive/StatusPill";

import type { AudienceDashboardViewModel } from "@/lib/workspace/AudienceTypes";
import { semanticColors, spacing, typography } from "@/design/tokens";

export default function AudienceDashboard({ dashboard }: { dashboard: AudienceDashboardViewModel }) {
  const audiences = dashboard.audiences ?? [];

  return (
    <ExecutiveStack gap="xl">
      <ExecutiveHeader
        title="Audiences"
        subtitle="Who matches each audience, why they belong, and whether you can reach them"
      />

      {audiences.length === 0 ? (
        <ExecutiveEmptyState title="No audiences configured" message="Install a package with segment definitions to see audiences." />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: spacing.md }}>
          {audiences.map((audience) => (
            <ExecutiveCard key={audience.segmentId}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: spacing.md, alignItems: "flex-start" }}>
                <div>
                  <Link
                    href={`/audiences/${audience.segmentId}`}
                    style={{ color: semanticColors.textPrimary, textDecoration: "none", fontWeight: 600 }}
                  >
                    {audience.segmentName}
                  </Link>
                  <div style={{ marginTop: spacing.xs, color: semanticColors.textSecondary, fontSize: typography.caption.fontSize }}>
                    {audience.purpose}
                  </div>
                  <div style={{ marginTop: spacing.sm, color: semanticColors.textMuted, fontSize: typography.caption.fontSize }}>
                    {audience.memberCount} member{audience.memberCount === 1 ? "" : "s"} · {audience.contactableCount} contactable ·{" "}
                    {audience.blockedCount} blocked
                  </div>
                </div>
                {audience.memberCount > 0 ? <StatusPill tone="success" label="Active" /> : <StatusPill tone="neutral" label="Empty" />}
              </div>
            </ExecutiveCard>
          ))}
        </div>
      )}
    </ExecutiveStack>
  );
}
