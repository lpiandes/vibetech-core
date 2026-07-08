"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";

import PrimaryButton from "@/components/product/PrimaryButton";
import { cockpitColors, spacing, typography } from "@/design/tokens";

export default function LoginForm() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
      callbackUrl,
    });
    setBusy(false);
    if (result?.error) {
      setError("Email or password is incorrect.");
      return;
    }
    window.location.href = result?.url ?? callbackUrl;
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
      </div>
    </div>
  );
}
