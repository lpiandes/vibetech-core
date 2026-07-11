"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cockpitColors, spacing, typography, radius } from "@/design/tokens";

const NAV = [
  { href: "/admin", label: "Dashboard", exact: true },
  { href: "/admin/businesses", label: "Businesses" },
  { href: "/admin/architect", label: "Architect" },
  { href: "/admin/blueprints", label: "Blueprints" },
  { href: "/admin/components", label: "Components" },
  { href: "/admin/employees", label: "Employees" },
  { href: "/admin/installations", label: "Installations" },
  { href: "/admin/support", label: "Support" },
  { href: "/admin/analytics", label: "Analytics" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/settings", label: "Settings" },
];

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div style={{
      minHeight: "100vh",
      display: "grid",
      gridTemplateColumns: "240px 1fr",
      background: cockpitColors.background,
    }}>
      <aside style={{
        background: cockpitColors.sidebar,
        color: "#fff",
        borderRight: `1px solid ${cockpitColors.sidebarBorder}`,
        padding: spacing.lg,
        display: "flex",
        flexDirection: "column",
        gap: spacing.md,
      }}>
        <div>
          <div style={{ fontWeight: 700, letterSpacing: "-0.02em" }}>VIBETech</div>
          <div style={{ color: "rgba(255,255,255,0.55)", fontSize: typography.caption.fontSize, marginTop: 4 }}>
            Admin control center
          </div>
        </div>
        <nav style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {NAV.map((item) => {
            const active = item.exact
              ? pathname === item.href
              : pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  textDecoration: "none",
                  color: active ? "#fff" : "rgba(255,255,255,0.7)",
                  background: active ? "rgba(255,255,255,0.08)" : "transparent",
                  borderRadius: radius.medium,
                  padding: `${spacing.sm}px ${spacing.md}px`,
                  fontSize: typography.body.fontSize,
                  fontWeight: active ? 600 : 500,
                }}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div style={{ marginTop: "auto", fontSize: typography.caption.fontSize, color: "rgba(255,255,255,0.45)" }}>
          Platform admins only · Audited access
        </div>
      </aside>
      <main style={{ padding: spacing.xl, minWidth: 0 }}>{children}</main>
    </div>
  );
}
