import Link from "next/link";

import { cockpitColors, spacing, typography } from "@/design/tokens";

/**
 * Next.js forbidden() UI + middleware rewrite target for /admin/** non-admins.
 * Must not use AdminShell or BusinessShell.
 */
export default function ForbiddenPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: cockpitColors.background,
        padding: spacing.lg,
      }}
    >
      <div style={{ maxWidth: 440, textAlign: "center" }}>
        <p style={{ margin: 0, color: cockpitColors.accent, fontWeight: 700 }}>VIBETech</p>
        <h1 style={{ margin: `${spacing.sm} 0`, fontSize: typography.pageTitle.fontSize, color: cockpitColors.textPrimary }}>
          Access denied
        </h1>
        <p style={{ margin: 0, color: cockpitColors.textSecondary, lineHeight: 1.55 }}>
          You do not have permission to view this page. If you need access, contact a platform administrator.
        </p>
        <div style={{ marginTop: spacing.lg, display: "flex", gap: spacing.sm, justifyContent: "center", flexWrap: "wrap" }}>
          <Link
            href="/"
            style={{
              display: "inline-flex",
              alignItems: "center",
              height: 40,
              padding: `0 ${spacing.lg}`,
              borderRadius: 8,
              background: cockpitColors.accent,
              color: "#fff",
              textDecoration: "none",
              fontWeight: 600,
            }}
          >
            Go home
          </Link>
          <Link
            href="/login"
            style={{
              display: "inline-flex",
              alignItems: "center",
              height: 40,
              padding: `0 ${spacing.lg}`,
              borderRadius: 8,
              border: `1px solid ${cockpitColors.panelBorder}`,
              color: cockpitColors.textPrimary,
              textDecoration: "none",
              fontWeight: 600,
            }}
          >
            Sign in
          </Link>
        </div>
      </div>
    </main>
  );
}
