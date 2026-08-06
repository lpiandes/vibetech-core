"use client";

import type { ReactNode, MouseEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  BookOpen,
  Calendar,
  CheckCircle2,
  Home,
  Kanban,
  Link2,
  Mail,
  Settings,
  Users,
  ClipboardList,
  TrendingUp,
  Zap,
} from "lucide-react";

import { useBusinessScope } from "@/lib/platform/BusinessScopeContext";
import { useWorkspaceNavigation } from "@/components/workspace/WorkspaceNavigationContext";
import {
  getCanonicalBusinessNav,
  groupCanonicalNav,
  type CanonicalNavItem,
} from "@/components/workspace/canonicalBusinessNavigation";
import { findActiveNavHref } from "@/components/shell/navActivePath";
import { brand, cockpitColors, spacing, typography, radius } from "@/design/tokens";

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
    case "check-circle":
      return <CheckCircle2 size={16} aria-hidden />;
    case "folder":
      return <ClipboardList size={16} aria-hidden />;
    case "calendar":
      return <Calendar size={16} aria-hidden />;
    case "kanban":
      return <Kanban size={16} aria-hidden />;
    case "zap":
      return <Zap size={16} aria-hidden />;
    case "trending-up":
      return <TrendingUp size={16} aria-hidden />;
    case "mail":
      return <Mail size={16} aria-hidden />;
    default:
      return <Home size={16} aria-hidden />;
  }
}

function subjectLabelFromScope(scope: ReturnType<typeof useBusinessScope>): string {
  const terminology = scope.installedBusinessOS?.terminology as any;
  const entities = terminology?.entityLabels ?? terminology?.presentation?.entityLabels ?? {};
  const subject =
    entities.property
    ?? entities.subject
    ?? entities.business_record
    ?? scope.installedBusinessOS?.subjectTypes?.[0]
    ?? "Business record";
  const label = String(subject).replace(/_/g, " ");
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function NavSection({
  title,
  items,
  activeHref,
  needsAttentionCount,
  onNavClick,
  onNavIntent,
}: {
  title?: string;
  items: CanonicalNavItem[];
  activeHref: string | null;
  needsAttentionCount: number;
  onNavClick: (href: string) => (event: MouseEvent<HTMLAnchorElement>) => void;
  onNavIntent: (href: string) => () => void;
}) {
  if (!items.length) return null;
  return (
    <div style={{ display: "grid", gap: 2 }}>
      {title ? (
        <div
          style={{
            padding: `${spacing.sm} ${spacing.md} 4px`,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            color: cockpitColors.sidebarTextMuted,
            opacity: 0.85,
          }}
        >
          {title}
        </div>
      ) : null}
      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 2 }}>
        {items.map((item) => {
          const active = activeHref === item.href;
          const badge =
            item.badgeKey === "needsAttention" && needsAttentionCount > 0 ? needsAttentionCount : null;
          return (
            <li key={item.id}>
              <Link
                href={item.href}
                onClick={onNavClick(item.href)}
                onMouseEnter={onNavIntent(item.href)}
                onFocus={onNavIntent(item.href)}
                data-tour-nav={item.id}
                aria-current={active ? "page" : undefined}
                style={{
                  position: "relative",
                  display: "flex",
                  alignItems: "center",
                  gap: spacing.sm,
                  padding: `${spacing.sm} ${spacing.md}`,
                  borderRadius: radius.medium,
                  textDecoration: "none",
                  color: active ? brand.text : cockpitColors.sidebarTextMuted,
                  backgroundColor: active ? cockpitColors.sidebarActive : "transparent",
                  boxShadow: active ? `inset 3px 0 0 ${brand.cyan}` : "none",
                  fontSize: typography.body.fontSize,
                  fontWeight: active ? 650 : 500,
                }}
              >
                <span
                  style={{
                    flexShrink: 0,
                    display: "flex",
                    color: active ? brand.cyan : "inherit",
                    opacity: active ? 1 : 0.75,
                  }}
                >
                  {iconForName(item.iconName)}
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>{item.label}</span>
                {badge != null ? (
                  <span
                    aria-label={`${badge} decisions waiting`}
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
    </div>
  );
}

export default function PrimaryNavigation({
  needsAttentionCount = 0,
  onNavigate,
}: {
  needsAttentionCount?: number;
  onNavigate?: () => void;
}) {
  const scope = useBusinessScope();
  const router = useRouter();
  const { displayPath, beginNavigation } = useWorkspaceNavigation();
  const specialtyModules = Array.isArray((scope.installedBusinessOS as { modules?: unknown[] } | null)?.modules)
    ? ((scope.installedBusinessOS as { modules: unknown[] }).modules as Array<Record<string, unknown>>)
    : [];
  const installedModuleIds = specialtyModules
    .map((module) => module.moduleId)
    .filter((moduleId): moduleId is string => typeof moduleId === "string");
  const roleDefinitions = Array.isArray(scope.installedBusinessOS?.roles)
    ? (scope.installedBusinessOS!.roles as Array<Record<string, unknown>>)
    : (scope.installedNavigation?.roles ?? scope.installedNavigation?.roleDefinitions ?? []);
  const items = getCanonicalBusinessNav(scope.businessId, scope.permissions, {
    role: scope.role,
    subjectLabel: subjectLabelFromScope(scope),
    installedModuleIds,
    specialtyModules: specialtyModules as any,
    purchasedPackages: scope.purchasedPackages ?? [],
    roleDefinitions,
  });
  const grouped = groupCanonicalNav(items);
  const supportAccess = scope.supportAccess;
  const activeHref = findActiveNavHref(
    displayPath,
    scope.businessId,
    items.map((item) => item.href),
  );

  // Prefetch on hover only — mass prefetch after login flooded cold serverless and slowed tabs.
  function onNavClick(href: string) {
    return (event: MouseEvent<HTMLAnchorElement>) => {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
      beginNavigation(href);
      onNavigate?.();
    };
  }

  function onNavIntent(href: string) {
    return () => {
      try {
        router.prefetch(href);
      } catch {
        /* ignore */
      }
    };
  }

  return (
    <nav aria-label="Primary" style={{ display: "flex", flexDirection: "column", height: "100%", padding: spacing.md, gap: spacing.md }}>
      <div style={{ padding: `0 ${spacing.xs}`, marginBottom: spacing.md }}>
        <div style={{ fontWeight: 700, fontSize: typography.body.fontSize, color: cockpitColors.sidebarText }}>
          VIBETech
        </div>
        <div style={{ marginTop: 2, fontSize: typography.meta.fontSize, color: cockpitColors.sidebarTextMuted, lineHeight: 1.35 }}>
          {scope.businessName || "Workspace"}
        </div>
        {supportAccess?.active ? (
          <div
            role="status"
            style={{
              marginTop: spacing.sm,
              padding: spacing.sm,
              borderRadius: radius.medium,
              backgroundColor: "rgba(15, 118, 110, 0.22)",
              color: cockpitColors.sidebarText,
              fontSize: typography.meta.fontSize,
              lineHeight: 1.4,
            }}
          >
            <div style={{ fontWeight: 700 }}>Admin view</div>
            <div style={{ opacity: 0.85 }}>
              {supportAccess.mode === "elevated" ? "Full edit" : "Read-only"} · audited
            </div>
          </div>
        ) : null}
      </div>

      <div style={{ display: "grid", gap: spacing.md, alignContent: "start", flex: 1, minHeight: 0, overflow: "auto" }}>
        <NavSection
          items={grouped.primary}
          activeHref={activeHref}
          needsAttentionCount={needsAttentionCount}
          onNavClick={onNavClick}
          onNavIntent={onNavIntent}
        />
        <NavSection
          title="Records"
          items={grouped.records}
          activeHref={activeHref}
          needsAttentionCount={needsAttentionCount}
          onNavClick={onNavClick}
          onNavIntent={onNavIntent}
        />
        <NavSection
          title="System"
          items={grouped.system}
          activeHref={activeHref}
          needsAttentionCount={needsAttentionCount}
          onNavClick={onNavClick}
          onNavIntent={onNavIntent}
        />
      </div>
    </nav>
  );
}
