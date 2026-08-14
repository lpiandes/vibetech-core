"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { insuranceFieldStyle, insuranceLabelStyle } from "./insuranceFormStyles";

export function InsuranceLoginForm({ callbackUrl = "/insurance" }: { callbackUrl?: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
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
      window.location.assign(result?.url ?? callbackUrl);
    } catch {
      setError("Could not sign in. Try again.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} style={{ display: "grid", gap: 14 }}>
      <label>
        <span style={insuranceLabelStyle}>Email</span>
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={insuranceFieldStyle}
        />
      </label>
      <label>
        <span style={insuranceLabelStyle}>Password</span>
        <input
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={insuranceFieldStyle}
        />
      </label>
      {error ? <p style={{ color: "#fca5a5", margin: 0, fontSize: 14 }}>{error}</p> : null}
      <Button type="submit" disabled={busy} size="lg" className="w-full h-11 font-semibold">
        {busy ? "Signing in…" : "Log in"}
      </Button>
    </form>
  );
}
