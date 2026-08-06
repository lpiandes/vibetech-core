"use client";

import Link from "next/link";
import { EmptyState, ActionButton } from "@/components/operating/Surface";
import GlobalAskVibeTechEntry from "@/components/shell/GlobalAskVibeTechEntry";
import { cockpitColors, spacing, typography } from "@/design/tokens";

/**
 * Empty / pre-operating home — operating brief path, not CRM module checklist (Plan 28).
 */
export default function EmptyOperatingState({
  businessId,
  businessName,
  hasInstalledOs,
}: {
  businessId: string;
  businessName: string;
  hasInstalledOs: boolean;
}) {
  const base = `/b/${encodeURIComponent(businessId)}`;

  if (!hasInstalledOs) {
    return (
      <EmptyState
        title={`${businessName} is not operating yet`}
        description="Describe how the business works, review the plan, and launch when you are ready. Nothing goes live until you approve."
        action={
          <div style={{ display: "flex", gap: spacing.sm, flexWrap: "wrap", justifyContent: "center" }}>
            <ActionButton href={`${base}/architect`}>
              Ask VIBETech to set this up
            </ActionButton>
          </div>
        }
      />
    );
  }

  return (
    <EmptyState
      title="Finish launch so VIBETech can operate"
      description="Connect email and calendar, prove one real case, then go live. Decisions and Outcomes fill when there is real work — not module counts."
      action={
        <div style={{ display: "grid", gap: spacing.md, justifyItems: "center" }}>
          <ul
            style={{
              listStyle: "none",
              margin: 0,
              padding: 0,
              display: "grid",
              gap: spacing.sm,
              textAlign: "left",
              maxWidth: 420,
              width: "100%",
            }}
          >
            {[
              { href: `${base}/integrations`, label: "1. Connect email & calendar" },
              { href: `${base}/home`, label: "2. Finish Today launch steps (prove → go live)" },
              { href: `${base}/intelligence`, label: "3. Review Decisions when something needs you" },
            ].map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  style={{
                    display: "block",
                    padding: `${spacing.sm} ${spacing.md}`,
                    borderRadius: 8,
                    border: `1px solid ${cockpitColors.panelBorder}`,
                    textDecoration: "none",
                    color: cockpitColors.textPrimary,
                    fontSize: typography.body.fontSize,
                    fontWeight: 600,
                  }}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
          <GlobalAskVibeTechEntry />
        </div>
      }
    />
  );
}
