"use client";

import Link from "next/link";
import { HelpCircle } from "lucide-react";

import NavigationSidebar from "@/components/workspace/NavigationSidebar";
import ImproveBusinessButton from "@/components/builder/ImproveBusinessButton";
import { useBusinessScope } from "@/lib/platform/BusinessScopeContext";
import { cockpitColors, spacing, typography } from "@/design/tokens";

export default function ShellSidebar() {
  const scope = useBusinessScope();
  const helpHref = `/b/${scope.businessId}/settings`;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ flex: 1, minHeight: 0, overflow: "auto" }}>
        <NavigationSidebar variant="dark" />
      </div>
      <div
        style={{
          padding: spacing.md,
          borderTop: `1px solid ${cockpitColors.sidebarBorder}`,
          flexShrink: 0,
          display: "grid",
          gap: spacing.sm,
        }}
      >
        <ImproveBusinessButton compact />
        <Link
          href={helpHref}
          style={{
            display: "flex",
            alignItems: "center",
            gap: spacing.sm,
            padding: `${spacing.sm} ${spacing.md}`,
            borderRadius: 8,
            color: cockpitColors.sidebarTextMuted,
            textDecoration: "none",
            fontSize: typography.caption.fontSize,
          }}
        >
          <HelpCircle size={16} />
          Help &amp; settings
        </Link>
      </div>
    </div>
  );
}
