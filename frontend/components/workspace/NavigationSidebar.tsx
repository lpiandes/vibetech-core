"use client";

import Link from "next/link";
import type { ReactNode, MouseEvent } from "react";
import {
  BarChart3,
  BookOpen,
  Bot,
  ClipboardList,
  Home,
  Link2,
  Mail,
  Settings,
  Users,
  AlertCircle,
  Workflow,
  Target,
} from "lucide-react";

import { useBusinessScope } from "@/lib/platform/BusinessScopeContext";
import { useWorkspaceNavigation } from "./WorkspaceNavigationContext";
import { getModuleDrivenNavSections } from "./moduleDrivenNavigation";
import { getActiveModuleIdFromPathname } from "./workspaceShellDerivations";
import { cockpitColors, spacing, typography, radius } from "@/design/tokens";

function iconForName(iconName: string | null): ReactNode {
  switch (iconName) {
    case "home":
      return <Home size={16} />;
    case "users":
      return <Users size={16} />;
    case "bot":
      return <Bot size={16} />;
    case "inbox":
      return <ClipboardList size={16} />;
    case "chart":
      return <BarChart3 size={16} />;
    case "book":
      return <BookOpen size={16} />;
    case "message-square":
      return <Mail size={16} />;
    case "link":
      return <Link2 size={16} />;
    case "settings":
      return <Settings size={16} />;
    case "alert-circle":
      return <AlertCircle size={16} />;
    case "workflow":
      return <Workflow size={16} />;
    case "target":
      return <Target size={16} />;
    default:
      return <Home size={16} />;
  }
}

export default function NavigationSidebar({ variant = "dark" }: { variant?: "light" | "dark" }) {
  const scope = useBusinessScope();
  const { displayPath, beginNavigation } = useWorkspaceNavigation();
  const grouped = getModuleDrivenNavSections(scope.businessId, scope.permissions, {
    role: scope.role,
    installed: (scope.installedNavigation ?? null) as never,
  });
  const activeModuleId = getActiveModuleIdFromPathname(displayPath);
  const businessName = scope.businessName || "VIBETech";
  const dark = variant === "dark";
  const sections = grouped.filter((section) => section.items.length > 0);
  const supportAccess = scope.supportAccess;

  function onNavClick(href: string) {
    return (event: MouseEvent<HTMLAnchorElement>) => {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
      beginNavigation(href);
    };
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", padding: spacing.md, gap: spacing.md }}>
      <div style={{ padding: `0 ${spacing.xs}`, marginBottom: spacing.sm }}>
        <div style={{ fontWeight: 700, fontSize: typography.body.fontSize, color: dark ? cockpitColors.sidebarText : cockpitColors.textPrimary }}>
          VIBETech
        </div>
        <div style={{ marginTop: 2, fontSize: typography.caption.fontSize, color: dark ? cockpitColors.sidebarTextMuted : cockpitColors.textMuted }}>
          {businessName}
        </div>
        {supportAccess?.active ? (
          <div
            style={{
              marginTop: spacing.sm,
              padding: spacing.sm,
              borderRadius: radius.medium,
              backgroundColor: dark ? "rgba(250, 204, 21, 0.15)" : "rgba(250, 204, 21, 0.25)",
              color: dark ? cockpitColors.sidebarText : cockpitColors.textPrimary,
              fontSize: typography.caption.fontSize,
            }}
          >
            Support access{supportAccess.mode ? ` (${supportAccess.mode})` : ""} — viewing as VIBETech admin
          </div>
        ) : null}
      </div>

      {sections.map((section, sectionIndex) => (
        <div
          key={String(section.id)}
          style={{
            marginTop: sectionIndex > 0 ? spacing.sm : 0,
            paddingTop: sectionIndex > 0 ? spacing.sm : 0,
            borderTop: sectionIndex > 0 ? `1px solid ${dark ? "rgba(255,255,255,0.08)" : cockpitColors.panelBorder}` : undefined,
          }}
        >
          {section.title ? (
            <div
              style={{
                padding: `0 ${spacing.xs} ${spacing.xs}`,
                fontSize: "0.65rem",
                fontWeight: 600,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: dark ? cockpitColors.sidebarTextMuted : cockpitColors.textMuted,
              }}
            >
              {section.title}
            </div>
          ) : null}
          <nav style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {section.items.map((item) => {
              const isActive = String(item.moduleId) === String(activeModuleId)
                || (item.moduleId === "work" && activeModuleId === "work_queue")
                || (item.moduleId === "people" && activeModuleId === "engagement")
                || (item.moduleId === "inbox" && activeModuleId === "communications")
                || (item.moduleId === "performance" && activeModuleId === "analytics")
                || (item.moduleId === "integrations" && activeModuleId === "connections")
                || (item.moduleId === "settings" && activeModuleId === "setup")
                || (item.moduleId === "digital_workforce" && activeModuleId === "digital_workforce");
              if (item.moduleId === "more") {
                return (
                  <div
                    key={item.id}
                    style={{
                      padding: `${spacing.sm} ${spacing.sm}`,
                      color: dark ? cockpitColors.sidebarTextMuted : cockpitColors.textMuted,
                      fontSize: typography.body.fontSize,
                    }}
                  >
                    More
                    {(item.overflowItems ?? []).map((overflow) => (
                      <Link
                        key={overflow.id}
                        href={overflow.href}
                        prefetch={true}
                        onClick={onNavClick(overflow.href)}
                        style={{
                          display: "block",
                          marginTop: 4,
                          paddingLeft: spacing.sm,
                          color: dark ? cockpitColors.sidebarText : cockpitColors.textPrimary,
                          textDecoration: "none",
                          fontSize: typography.caption.fontSize,
                        }}
                      >
                        {overflow.label}
                      </Link>
                    ))}
                  </div>
                );
              }
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  prefetch={true}
                  onClick={onNavClick(item.href)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: spacing.sm,
                    padding: `${spacing.sm} ${spacing.sm}`,
                    borderRadius: radius.medium,
                    textDecoration: "none",
                    backgroundColor: isActive ? (dark ? cockpitColors.sidebarActive : cockpitColors.accentMuted) : "transparent",
                    color: dark ? cockpitColors.sidebarText : cockpitColors.textPrimary,
                  }}
                  aria-current={isActive ? "page" : undefined}
                >
                  <span style={{ display: "flex", alignItems: "center", gap: spacing.sm, minWidth: 0 }}>
                    <span style={{ opacity: isActive ? 1 : 0.7, display: "inline-flex" }}>{iconForName(item.iconName)}</span>
                    <span style={{ fontSize: typography.body.fontSize, fontWeight: isActive ? 600 : 400, lineHeight: 1.3 }}>{item.label}</span>
                  </span>
                </Link>
              );
            })}
          </nav>
        </div>
      ))}
    </div>
  );
}
