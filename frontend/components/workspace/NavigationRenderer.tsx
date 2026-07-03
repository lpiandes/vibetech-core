import type { ReactNode } from "react";
import Link from "next/link";
import {
  BarChart3,
  BookOpen,
  ClipboardList,
  LayoutDashboard,
  LineChart,
  Mail,
  Sparkles,
  Sun,
  Users,
  Activity,
  Plug,
} from "lucide-react";

import { deriveSidebarNavItems } from "./workspaceShellDerivations";

import { semanticColors, spacing, typography, radius, shadows } from "@/design/tokens";
import ExecutiveSurface from "@/components/executive/ExecutiveSurface";
import ExecutiveStack from "@/components/executive/ExecutiveStack";
import ExecutiveDivider from "@/components/executive/ExecutiveDivider";
import StatusPill from "@/components/executive/StatusPill";

function iconForName(iconName: string | null): ReactNode {
  switch (iconName) {
    case "dashboard":
      return <LayoutDashboard style={{ width: spacing.md, height: spacing.md }} />;
    case "users":
      return <Users style={{ width: spacing.md, height: spacing.md }} />;
    case "inbox":
      return <ClipboardList style={{ width: spacing.md, height: spacing.md }} />;
    case "chart":
      return <BarChart3 style={{ width: spacing.md, height: spacing.md }} />;
    case "book":
      return <BookOpen style={{ width: spacing.md, height: spacing.md }} />;
    case "sparkles":
      return <Sparkles style={{ width: spacing.md, height: spacing.md }} />;
    case "sun":
      return <Sun style={{ width: spacing.md, height: spacing.md }} />;
    case "mail":
      return <Mail style={{ width: spacing.md, height: spacing.md }} />;
    case "plug":
      return <Plug style={{ width: spacing.md, height: spacing.md }} />;
    case "activity-health":
      return <Activity style={{ width: spacing.md, height: spacing.md }} />;
    default:
      return <LineChart style={{ width: spacing.md, height: spacing.md }} />;
  }
}

export default function NavigationRenderer({
  workspaceViewModel,
}: {
  workspaceViewModel: any;
}) {
  const items = deriveSidebarNavItems(workspaceViewModel);
  const activeId = items[0]?.id ?? null;

  return (
    <ExecutiveSurface>
      <div
        style={{
          height: "100%",
          display: "flex",
          flexDirection: "column",
          padding: spacing.md,
          gap: spacing.md,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: spacing.md, padding: spacing.sm }}>
          <div
            style={{
              width: spacing.xl,
              height: spacing.xl,
              borderRadius: radius.large,
              border: `1px solid ${semanticColors.border}`,
              backgroundColor: semanticColors.surfaceSecondary,
              boxShadow: shadows.subtle,
            }}
            aria-hidden="true"
          />
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: typography.sectionTitle.fontSize, lineHeight: typography.sectionTitle.lineHeight, fontWeight: typography.sectionTitle.fontWeight, color: semanticColors.textPrimary }}>
              VIBETech
            </div>
            <div style={{ marginTop: spacing.xs, fontSize: typography.caption.fontSize, lineHeight: typography.caption.lineHeight, fontWeight: typography.caption.fontWeight, color: semanticColors.textMuted }}>
              Business Operating System
            </div>
          </div>
        </div>

        <ExecutiveDivider />

        <ExecutiveStack gap="sm">
          <div style={{ padding: `0 ${spacing.sm}` }}>
            <div style={{ fontSize: typography.label.fontSize, lineHeight: typography.label.lineHeight, fontWeight: typography.label.fontWeight, color: semanticColors.textSecondary }}>
              Navigation
            </div>
          </div>
          <nav style={{ display: "flex", flexDirection: "column", gap: spacing.xs }}>
            {items.map((item) => {
              const isActive = String(item.id) === String(activeId);
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: spacing.sm,
                    padding: `${spacing.sm} ${spacing.sm}`,
                    borderRadius: radius.large,
                    textDecoration: "none",
                    border: `1px solid ${isActive ? semanticColors.accent : semanticColors.border}`,
                    backgroundColor: isActive ? semanticColors.surfaceElevated : "transparent",
                  }}
                  aria-current={isActive ? "page" : undefined}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: spacing.sm, minWidth: 0 }}>
                    <span style={{ color: semanticColors.textMuted, display: "inline-flex" }}>{iconForName(item.iconName)}</span>
                    <span
                      className="hidden md:inline"
                      style={{
                        fontSize: typography.body.fontSize,
                        lineHeight: typography.body.lineHeight,
                        fontWeight: typography.body.fontWeight,
                        color: semanticColors.textPrimary,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {item.label}
                    </span>
                  </div>
                  {isActive ? (
                    <span className="hidden md:inline-flex">
                      <StatusPill tone="accent" label="Active" />
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </nav>
        </ExecutiveStack>

        <ExecutiveDivider />

        <ExecutiveStack gap="sm">
          <div style={{ padding: `0 ${spacing.sm}` }}>
            <div style={{ fontSize: typography.label.fontSize, lineHeight: typography.label.lineHeight, fontWeight: typography.label.fontWeight, color: semanticColors.textSecondary }}>
              Favorites (placeholder)
            </div>
          </div>
          <div style={{ padding: `0 ${spacing.sm}`, color: semanticColors.textMuted, fontSize: typography.caption.fontSize }}>
            Future favorites area. No workspace switching implemented yet.
          </div>

          <div style={{ padding: `0 ${spacing.sm}` }}>
            <div style={{ fontSize: typography.label.fontSize, lineHeight: typography.label.lineHeight, fontWeight: typography.label.fontWeight, color: semanticColors.textSecondary }}>
              Recent items (placeholder)
            </div>
          </div>
          <div style={{ padding: `0 ${spacing.sm}`, color: semanticColors.textMuted, fontSize: typography.caption.fontSize }}>
            Future recent items area. Deterministic executive navigation only.
          </div>
        </ExecutiveStack>
      </div>
    </ExecutiveSurface>
  );
}

