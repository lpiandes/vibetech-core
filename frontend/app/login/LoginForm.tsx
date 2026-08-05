"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";

import { cockpitColors, spacing, typography } from "@/design/tokens";
import { sanitizeCallbackUrl } from "@/lib/platform/routeProtection";

export default function LoginForm() {
  const searchParams = useSearchParams();
  const callbackUrl = sanitizeCallbackUrl(searchParams.get("callbackUrl"), "/");
  const routeError = searchParams.get("error");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(
    routeError === "no_business"
      ? "No business membership was found for this account. Ask an owner for an invitation, or open Architect to design a new business."
      : null,
  );
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
        callbackUrl,
      });
      if (result?.error) {
        setError("Email or password is incorrect.");
        setBusy(false);
        return;
      }
      // Keep "Signing in…" until the browser leaves this page.
      window.location.assign(result?.url ?? callbackUrl);
    } catch {
      setError("Could not sign in. Try again.");
      setBusy(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: cockpitColors.background, padding: spacing.lg }}>
      <div style={{ width: "100%", maxWidth: 400 }}>
        <p style={{ color: cockpitColors.accent, fontWeight: 700, margin: 0 }}>VIBETech</p>
        <h1 style={{ ...typography.pageTitle, margin: `${spacing.sm} 0 ${spacing.lg}` }}>Sign in</h1>
        <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: spacing.md }}>
          <label style={{ display: "flex", flexDirection: "column", gap: spacing.xs }}>
            <span style={{ fontSize: typography.caption.fontSize, fontWeight: 600 }}>Email</span>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{ padding: `${spacing.sm} ${spacing.md}`, borderRadius: 8, border: `1px solid ${cockpitColors.panelBorder}` }}
            />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: spacing.xs }}>
            <span style={{ fontSize: typography.caption.fontSize, fontWeight: 600 }}>Password</span>
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ padding: `${spacing.sm} ${spacing.md}`, borderRadius: 8, border: `1px solid ${cockpitColors.panelBorder}` }}
            />
          </label>
          {error ? <p style={{ color: "#dc2626", margin: 0, fontSize: typography.caption.fontSize }}>{error}</p> : null}
          <button
            type="submit"
            disabled={busy}
            style={{
              border: "none",
              borderRadius: 8,
              background: cockpitColors.accent,
              color: "#fff",
              fontWeight: 600,
              padding: "10px 14px",
              cursor: busy ? "wait" : "pointer",
            }}
          >
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <p style={{ margin: `${spacing.lg} 0 0`, color: cockpitColors.textMuted, fontSize: typography.caption.fontSize, lineHeight: 1.5 }}>
          Have an invitation? Open the invite link from your email. Need a new business?{" "}
          <a href="/architect" style={{ color: cockpitColors.accent, fontWeight: 600 }}>Start with Ask VIBETech</a>.
        </p>
      </div>
    </div>
  );
}
