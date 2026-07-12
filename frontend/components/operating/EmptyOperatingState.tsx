"use client";

import Link from "next/link";
import { EmptyState, ActionButton } from "@/components/operating/Surface";
import GlobalAskVibeTechEntry from "@/components/shell/GlobalAskVibeTechEntry";
import { cockpitColors, spacing, typography } from "@/design/tokens";

/**
 * Empty / pre-operating home — guide into Architect, not blank modules.
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
        description="Open Architect to describe how the business works, review the proposed operating system, and launch when you are ready."
        action={
          <div style={{ display: "flex", gap: spacing.sm, flexWrap: "wrap", justifyContent: "center" }}>
            <ActionButton href="/architect">
              Open Architect
            </ActionButton>
          </div>
        }
      />
    );
  }

  return (
    <EmptyState
      title="Your business OS is installed"
      description="Next, give VIBETech something to work with — then Needs Attention and Home will fill with live supervision."
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
              { href: `${base}/integrations`, label: "Connect an integration or import data" },
              { href: `${base}/team`, label: "Invite your team" },
              { href: `${base}/knowledge`, label: "Add knowledge the business relies on" },
              { href: `${base}/architect`, label: "Ask Architect what to set up next" },
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
