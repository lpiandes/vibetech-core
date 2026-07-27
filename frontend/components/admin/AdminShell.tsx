"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  Activity,
  BarChart3,
  Boxes,
  Building2,
  LayoutDashboard,
  Layers,
  LifeBuoy,
  LogOut,
  Package,
  Settings,
  Sparkles,
  Users,
  Bot,
} from "lucide-react";

import PageContainer from "@/components/layout/PageContainer";
import { cockpitColors, spacing, typography, radius } from "@/design/tokens";

type NavItem = {
  href: string;
  label: string;
  icon: ReactNode;
  exact?: boolean;
};

type NavSection = {
  label: string;
  items: NavItem[];
};

const NAV_SECTIONS: NavSection[] = [
  {
    label: "Operate",
    items: [
      { href: "/admin", label: "Dashboard", icon: <LayoutDashboard size={16} aria-hidden />, exact: true },
      { href: "/admin/health", label: "Health", icon: <Activity size={16} aria-hidden /> },
      { href: "/admin/businesses", label: "Businesses", icon: <Building2 size={16} aria-hidden /> },
      { href: "/admin/support", label: "Support", icon: <LifeBuoy size={16} aria-hidden /> },
    ],
  },
  {
    label: "Catalog",
    items: [
      { href: "/admin/architect", label: "Architect", icon: <Sparkles size={16} aria-hidden /> },
      { href: "/admin/blueprints", label: "Blueprints", icon: <Layers size={16} aria-hidden /> },
      { href: "/admin/components", label: "Components", icon: <Boxes size={16} aria-hidden /> },
      { href: "/admin/employees", label: "Employees", icon: <Bot size={16} aria-hidden /> },
      { href: "/admin/installations", label: "Installations", icon: <Package size={16} aria-hidden /> },
    ],
  },
  {
    label: "Platform",
    items: [
      { href: "/admin/analytics", label: "Analytics", icon: <BarChart3 size={16} aria-hidden /> },
      { href: "/admin/users", label: "Users", icon: <Users size={16} aria-hidden /> },
      { href: "/admin/settings", label: "Settings", icon: <Settings size={16} aria-hidden /> },
    ],
  },
];

function isActive(pathname: string, item: NavItem) {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

/**
 * Admin chrome aligned to client BusinessShell / PrimaryNavigation language:
 * 280px dark icon sidebar, teal active rail, cream PageContainer main.
 */
export default function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";

  return (
    <div
      style={{
        height: "100dvh",
        maxHeight: "100dvh",
        width: "100%",
        backgroundColor: cockpitColors.background,
        color: cockpitColors.textPrimary,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <div style={{ display: "flex", flex: 1, minHeight: 0, overflow: "hidden" }}>
        <aside
          aria-label="Admin navigation"
          style={{
            width: 280,
            flexShrink: 0,
            height: "100%",
            backgroundColor: cockpitColors.sidebar,
            borderRight: `1px solid ${cockpitColors.sidebarBorder}`,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          <nav
            aria-label="Primary"
            style={{
              display: "flex",
              flexDirection: "column",
              height: "100%",
              padding: spacing.md,
              gap: spacing.md,
              minHeight: 0,
              overflow: "hidden",
            }}
          >
            <div style={{ padding: `0 ${spacing.xs}`, marginBottom: spacing.sm, flexShrink: 0 }}>
              <div style={{ fontWeight: 700, fontSize: typography.body.fontSize, color: cockpitColors.sidebarText }}>
                VIBETech
              </div>
              <div style={{ marginTop: 2, fontSize: typography.meta.fontSize, color: cockpitColors.sidebarTextMuted }}>
                Admin control center
              </div>
            </div>

            <div
              style={{
                flex: 1,
                minHeight: 0,
                overflowY: "auto",
                display: "flex",
                flexDirection: "column",
                gap: spacing.md,
              }}
            >
              {NAV_SECTIONS.map((section) => (
                <div key={section.label}>
                  <div
                    style={{
                      padding: `0 ${spacing.md}`,
                      marginBottom: 6,
                      fontSize: 10,
                      fontWeight: 800,
                      letterSpacing: "0.1em",
                      textTransform: "uppercase",
                      color: cockpitColors.sidebarTextMuted,
                    }}
                  >
                    {section.label}
                  </div>
                  <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 2 }}>
                    {section.items.map((item) => {
                      const active = isActive(pathname, item);
                      return (
                        <li key={item.href}>
                          <Link
                            href={item.href}
                            aria-current={active ? "page" : undefined}
                            style={{
                              position: "relative",
                              display: "flex",
                              alignItems: "center",
                              gap: spacing.sm,
                              padding: `${spacing.sm} ${spacing.md}`,
                              borderRadius: radius.medium,
                              textDecoration: "none",
                              color: active ? "#fff" : cockpitColors.sidebarTextMuted,
                              backgroundColor: active ? "rgba(255,255,255,0.14)" : "transparent",
                              boxShadow: active ? `inset 3px 0 0 ${cockpitColors.accent}` : "none",
                              fontSize: typography.body.fontSize,
                              fontWeight: active ? 650 : 500,
                            }}
                          >
                            <span
                              style={{
                                flexShrink: 0,
                                display: "flex",
                                color: active ? cockpitColors.accent : "inherit",
                                opacity: active ? 1 : 0.75,
                              }}
                            >
                              {item.icon}
                            </span>
                            <span style={{ flex: 1, minWidth: 0 }}>{item.label}</span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          </nav>

          <div
            style={{
              padding: spacing.md,
              borderTop: `1px solid ${cockpitColors.sidebarBorder}`,
              flexShrink: 0,
              display: "grid",
              gap: spacing.sm,
            }}
          >
            <div style={{ fontSize: typography.meta.fontSize, color: cockpitColors.sidebarTextMuted, lineHeight: 1.4 }}>
              Platform admins only · Audited access
            </div>
            <button
              type="button"
              onClick={() => void signOut({ callbackUrl: "/login" })}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                height: 34,
                padding: `0 ${spacing.sm}`,
                borderRadius: radius.medium,
                border: `1px solid ${cockpitColors.sidebarBorder}`,
                background: "transparent",
                color: cockpitColors.sidebarText,
                cursor: "pointer",
                fontSize: typography.caption.fontSize,
                fontWeight: 600,
                width: "fit-content",
              }}
            >
              <LogOut size={14} aria-hidden />
              Sign out
            </button>
          </div>
        </aside>

        <div
          style={{
            display: "flex",
            minWidth: 0,
            flex: 1,
            flexDirection: "column",
            minHeight: 0,
            overflow: "hidden",
          }}
        >
          <AdminTopBar />
          <main
            id="main-content"
            style={{
              flex: 1,
              minHeight: 0,
              overflow: "auto",
            }}
          >
            <PageContainer>{children}</PageContainer>
          </main>
        </div>
      </div>
    </div>
  );
}

function AdminTopBar() {
  return (
    <header
      style={{
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: spacing.lg,
        padding: `${spacing.sm} ${spacing.lg}`,
        borderBottom: `1px solid ${cockpitColors.panelBorder}`,
        backgroundColor: cockpitColors.panel,
        position: "sticky",
        top: 0,
        zIndex: 20,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: spacing.sm, minWidth: 0 }}>
        <span style={{ fontSize: 12, color: cockpitColors.textMuted, fontWeight: 600 }}>Admin</span>
        <span style={{ color: cockpitColors.textMuted }} aria-hidden>/</span>
        <span style={{ fontSize: typography.body.fontSize, fontWeight: 700, color: cockpitColors.textPrimary }}>
          Platform control
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: spacing.sm }}>
        <Link
          href="/platform"
          style={{
            display: "inline-flex",
            alignItems: "center",
            height: 34,
            padding: `0 ${spacing.md}`,
            borderRadius: radius.medium,
            background: cockpitColors.accent,
            color: "#fff",
            textDecoration: "none",
            fontSize: typography.caption.fontSize,
            fontWeight: 700,
          }}
        >
          Create business
        </Link>
        <Link
          href="/admin/health"
          style={{
            display: "inline-flex",
            alignItems: "center",
            height: 34,
            padding: `0 ${spacing.md}`,
            borderRadius: radius.medium,
            border: `1px solid ${cockpitColors.panelBorder}`,
            background: "transparent",
            color: cockpitColors.textPrimary,
            textDecoration: "none",
            fontSize: typography.caption.fontSize,
            fontWeight: 600,
          }}
        >
          Health
        </Link>
      </div>
    </header>
  );
}
