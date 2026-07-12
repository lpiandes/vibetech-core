import Link from "next/link";

import { cockpitColors, spacing, typography } from "@/design/tokens";

/** Next.js unauthorized() UI — sign-in required. */
export default function UnauthorizedPage() {
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
          Sign in required
        </h1>
        <p style={{ margin: 0, color: cockpitColors.textSecondary, lineHeight: 1.55 }}>
          You need to sign in to continue.
        </p>
        <div style={{ marginTop: spacing.lg }}>
          <Link
            href="/login"
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
            Sign in
          </Link>
        </div>
      </div>
    </main>
  );
}
