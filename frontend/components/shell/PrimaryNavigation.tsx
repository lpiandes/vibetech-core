"use client";

import type { ReactNode, MouseEvent } from "react";
import Link from "next/link";
import {
  AlertCircle,
  BookOpen,
  Home,
  Link2,
  Settings,
  Users,
  ClipboardList,
} from "lucide-react";

import { useBusinessScope } from "@/lib/platform/BusinessScopeContext";
import { useWorkspaceNavigation } from "@/components/workspace/WorkspaceNavigationContext";
import { getCanonicalBusinessNav } from "@/components/workspace/canonicalBusinessNavigation";
import { cockpitColors, spacing, typography, radius } from "@/design/tokens";

function iconForName(iconName: string): ReactNode {
  switch (iconName) {
    case "users":
      return <Users size={16} aria-hidden />;
    case "inbox":
      return <ClipboardList size={16} aria-hidden />;
    case "book":
      return <BookOpen size={16} aria-hidden />;
    case "link":
      return <Link2 size={16} aria-hidden />;
    case "settings":
      return <Settings size={16} aria-hidden />;
    case "alert-circle":
      return <AlertCircle size={16} aria-hidden />;
    default:
      return <Home size={16} aria-hidden />;
  }
}

function subjectLabelFromScope(scope: ReturnType<typeof useBusinessScope>): string {
  const terminology = scope.installedBusinessOS?.terminology as any;
  const entities = terminology?.entityLabels ?? terminology?.presentation?.entityLabels ?? {};
  const subject =
    entities.property ?? entities.subject ?? scope.installedBusinessOS?.subjectTypes?.[0] ?? "Properties";
  const label = String(subject).replace(/_/g, " ");
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export default function PrimaryNavigation({
  needsAttentionCount = 0,
  onNavigate,
}: {
  needsAttentionCount?: number;
  onNavigate?: () => void;
}) {
  const scope = useBusinessScope();
  const { displayPath, beginNavigation } = useWorkspaceNavigation();
  const items = getCanonicalBusinessNav(scope.businessId, scope.permissions, {
    role: scope.role,
    subjectLabel: subjectLabelFromScope(scope),
  });
  const supportAccess = scope.supportAccess;

  function onNavClick(href: string) {
    return (event: MouseEvent<HTMLAnchorElement>) => {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
      beginNavigation(href);
      onNavigate?.();
    };
  }

  function isActive(href: string): boolean {
    const path = displayPath.split("?")[0];
    if (href.endsWith("/home")) return path.endsWith("/home") || /\/b\/[^/]+$/.test(path);
    return path === href || path.startsWith(`${href}/`);
  }

  return (
    <nav aria-label="Primary" style={{ display: "flex", flexDirection: "column", height: "100%", padding: spacing.md, gap: spacing.md }}>
      <div style={{ padding: `0 ${spacing.xs}`, marginBottom: spacing.sm }}>
        <div style={{ fontWeight: 700, fontSize: typography.body.fontSize, color: cockpitColors.sidebarText }}>
          VIBETech
        </div>
        <div style={{ marginTop: 2, fontSize: typography.meta.fontSize, color: cockpitColors.sidebarTextMuted }}>
          {scope.businessName || "Workspace"}
        </div>
        {supportAccess?.active ? (
          <div
            role="status"
            style={{
              marginTop: spacing.sm,
              padding: spacing.sm,
              borderRadius: radius.medium,
              backgroundColor: "rgba(250, 204, 21, 0.15)",
              color: cockpitColors.sidebarText,
              fontSize: typography.meta.fontSize,
            }}
          >
            Support access active{supportAccess.mode ? ` · ${supportAccess.mode}` : ""}
          </div>
        ) : null}
      </div>

      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 2, flex: 1 }}>
        {items.map((item) => {
          const active = isActive(item.href);
          const badge =
            item.badgeKey === "needsAttention" && needsAttentionCount > 0 ? needsAttentionCount : null;
          return (
            <li key={item.id}>
              <Link
                href={item.href}
                onClick={onNavClick(item.href)}
                aria-current={active ? "page" : undefined}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: spacing.sm,
                  padding: `${spacing.sm} ${spacing.md}`,
                  borderRadius: radius.medium,
                  textDecoration: "none",
                  color: active ? cockpitColors.sidebarText : cockpitColors.sidebarTextMuted,
                  backgroundColor: active ? cockpitColors.sidebarActive : "transparent",
                  fontSize: typography.body.fontSize,
                  fontWeight: active ? 600 : 500,
                }}
              >
                <span style={{ flexShrink: 0, display: "flex" }}>{iconForName(item.iconName)}</span>
                <span style={{ flex: 1, minWidth: 0 }}>{item.label}</span>
                {badge != null ? (
                  <span
                    aria-label={`${badge} need attention`}
                    style={{
                      minWidth: 20,
                      height: 20,
                      borderRadius: radius.pill,
                      backgroundColor: cockpitColors.warning,
                      color: "#fff",
                      fontSize: 11,
                      fontWeight: 700,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: "0 6px",
                    }}
                  >
                    {badge > 99 ? "99+" : badge}
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
