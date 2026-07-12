"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

import PrimaryButton from "@/components/product/PrimaryButton";
import SecondaryButton from "@/components/product/SecondaryButton";
import { cockpitColors, spacing, typography } from "@/design/tokens";

type InviteErrorReason = "not_found" | "expired" | "revoked" | "accepted" | "server_error" | "network_error";

type InviteLoadState =
  | { status: "loading" }
  | { status: "ready"; valid: true; email: string; businessName: string; roleLabel?: string; businessId: string }
  | {
      status: "error";
      reason: InviteErrorReason;
      message: string;
      email?: string | null;
      businessName?: string | null;
      businessId?: string | null;
    };

type SubmitPhase = "idle" | "creating" | "entering";

function messageForReason(reason: string) {
  if (reason === "expired") return "This invitation has expired.";
  if (reason === "revoked") return "This invitation is no longer available.";
  if (reason === "accepted") return "This invitation has already been accepted.";
  if (reason === "server_error") return "We could not load this invitation.";
  if (reason === "network_error") return "Could not reach the server.";
  return "This invitation is not valid.";
}

async function fetchInvitation(token: string): Promise<InviteLoadState> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch(`/api/invite/${encodeURIComponent(token)}`, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });

    let data: Record<string, unknown> | null = null;
    try {
      data = await res.json();
    } catch {
      return {
        status: "error",
        reason: "server_error",
        message: "The invitation service returned an invalid response.",
      };
    }

    if (!data) {
      return {
        status: "error",
        reason: "server_error",
        message: "The invitation service returned an empty response.",
      };
    }

    if (data.valid === true) {
      return {
        status: "ready",
        valid: true,
        email: String(data.email ?? ""),
        businessName: String(data.businessName ?? "Business"),
        roleLabel: data.roleLabel ? String(data.roleLabel) : undefined,
        businessId: String(data.businessId ?? ""),
      };
    }

    const reason = String(data.reason ?? "not_found") as InviteErrorReason;
    return {
      status: "error",
      reason,
      message: String(data.error ?? messageForReason(reason)),
      email: data.email ? String(data.email) : null,
      businessName: data.businessName ? String(data.businessName) : null,
      businessId: data.businessId ? String(data.businessId) : null,
    };
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      return {
        status: "error",
        reason: "network_error",
        message: "The request timed out. Check your connection and try again.",
      };
    }
    return {
      status: "error",
      reason: "network_error",
      message: "Could not reach the server.",
    };
  } finally {
    window.clearTimeout(timeout);
  }
}

function InviteShell({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: cockpitColors.background,
        padding: spacing.lg,
      }}
    >
      <div style={{ width: "100%", maxWidth: 420 }}>{children}</div>
    </div>
  );
}

export default function InviteAcceptPage() {
  const params = useParams<{ token: string }>();
  const token = String(params?.token ?? "").trim();
  const [state, setState] = useState<InviteLoadState>({ status: "loading" });
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitPhase, setSubmitPhase] = useState<SubmitPhase>("idle");
  const submittingRef = useRef(false);

  const loadInvitation = useCallback(async () => {
    if (!token) {
      setState({
        status: "error",
        reason: "not_found",
        message: "Invitation link is missing a token.",
      });
      return;
    }
    setState({ status: "loading" });
    setError(null);
    const next = await fetchInvitation(token);
    setState(next);
  }, [token]);

  useEffect(() => {
    void loadInvitation();
  }, [loadInvitation]);

  async function accept() {
    if (state.status !== "ready" || submittingRef.current) return;
    submittingRef.current = true;
    setSubmitPhase("creating");
    setError(null);

    try {
      const res = await fetch(`/api/invite/${encodeURIComponent(token)}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(String(data.error ?? "Could not accept invitation."));
        setSubmitPhase("idle");
        submittingRef.current = false;
        return;
      }

      const redirectTo =
        typeof data.redirectTo === "string"
          ? data.redirectTo
          : `/b/${String(data.businessId ?? state.businessId)}/home`;

      if (data.needsSignIn) {
        window.location.assign(`/login?callbackUrl=${encodeURIComponent(redirectTo)}`);
        return;
      }

      setSubmitPhase("entering");
      window.location.assign(redirectTo);
    } catch {
      setError("Could not accept invitation. Try again.");
      setSubmitPhase("idle");
      submittingRef.current = false;
    }
  }

  if (state.status === "loading") {
    return (
      <InviteShell>
        <p style={{ color: cockpitColors.accent, fontWeight: 700, margin: 0 }}>VIBETech</p>
        <h1 style={{ ...typography.pageTitle, margin: `${spacing.sm} 0` }}>Loading invitation…</h1>
        <p style={{ color: cockpitColors.textMuted, margin: 0 }}>Checking your invite link.</p>
      </InviteShell>
    );
  }

  if (state.status === "error") {
    return (
      <InviteShell>
        <p style={{ color: cockpitColors.accent, fontWeight: 700, margin: 0 }}>VIBETech</p>
        <h1 style={{ ...typography.pageTitle, margin: `${spacing.sm} 0` }}>{state.message}</h1>
        {state.businessName ? (
          <p style={{ color: cockpitColors.textSecondary, margin: `0 0 ${spacing.md}` }}>
            {state.businessName}
            {state.email ? ` · ${state.email}` : ""}
          </p>
        ) : null}
        <div style={{ display: "flex", gap: spacing.sm, flexWrap: "wrap" }}>
          <PrimaryButton onClick={() => void loadInvitation()}>Retry</PrimaryButton>
          {state.reason === "accepted" && state.businessId ? (
            <SecondaryButton href={`/login?callbackUrl=${encodeURIComponent(`/b/${state.businessId}/home`)}`}>
              Sign in
            </SecondaryButton>
          ) : (
            <SecondaryButton href="/login">Back to login</SecondaryButton>
          )}
        </div>
      </InviteShell>
    );
  }

  if (submitPhase === "entering") {
    return (
      <InviteShell>
        <p style={{ color: cockpitColors.accent, fontWeight: 700, margin: 0 }}>VIBETech</p>
        <h1 style={{ ...typography.pageTitle, margin: `${spacing.sm} 0` }}>Taking you to {state.businessName}…</h1>
        <p style={{ color: cockpitColors.textMuted, margin: 0 }}>
          Your account is ready. Next you&apos;ll design how the business runs, or open Home if it is already live.
        </p>
      </InviteShell>
    );
  }

  const formDisabled = submitPhase !== "idle";
  const buttonLabel =
    submitPhase === "creating" ? "Creating your account…" : "Accept invitation";

  return (
    <InviteShell>
      <p style={{ color: cockpitColors.accent, fontWeight: 700, margin: 0 }}>VIBETech</p>
      <h1 style={{ ...typography.pageTitle, margin: `${spacing.sm} 0` }}>Join {state.businessName}</h1>
      <p style={{ color: cockpitColors.textSecondary, margin: `0 0 ${spacing.md}` }}>
        You&apos;ve been invited to join {state.businessName} on VIBETech.
        {state.roleLabel && /owner/i.test(state.roleLabel)
          ? " After you join, VIBETech will help you design how the business runs and launch when you are ready."
          : " After you join, you can open the business and start supervising work."}
      </p>
      <div
        style={{
          marginBottom: spacing.lg,
          padding: spacing.md,
          borderRadius: 8,
          border: `1px solid ${cockpitColors.panelBorder}`,
          background: cockpitColors.panel,
        }}
      >
        <div style={{ fontSize: typography.caption.fontSize, color: cockpitColors.textMuted }}>Business</div>
        <div style={{ fontWeight: 600 }}>{state.businessName}</div>
        <div style={{ marginTop: spacing.sm, fontSize: typography.caption.fontSize, color: cockpitColors.textMuted }}>Invited email</div>
        <div style={{ fontWeight: 600 }}>{state.email}</div>
        {state.roleLabel ? (
          <>
            <div style={{ marginTop: spacing.sm, fontSize: typography.caption.fontSize, color: cockpitColors.textMuted }}>Role</div>
            <div>{state.roleLabel}</div>
          </>
        ) : null}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: spacing.md }}>
        <label style={{ display: "flex", flexDirection: "column", gap: spacing.xs }}>
          <span style={{ fontSize: typography.caption.fontSize, fontWeight: 600 }}>Your name</span>
          <input
            value={name}
            disabled={formDisabled}
            onChange={(e) => setName(e.target.value)}
            style={{ padding: `${spacing.sm} ${spacing.md}`, borderRadius: 8, border: `1px solid ${cockpitColors.panelBorder}` }}
          />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: spacing.xs }}>
          <span style={{ fontSize: typography.caption.fontSize, fontWeight: 600 }}>Password</span>
          <input
            type="password"
            value={password}
            disabled={formDisabled}
            onChange={(e) => setPassword(e.target.value)}
            style={{ padding: `${spacing.sm} ${spacing.md}`, borderRadius: 8, border: `1px solid ${cockpitColors.panelBorder}` }}
          />
        </label>
        {error ? <p style={{ color: "#dc2626", margin: 0 }}>{error}</p> : null}
        <PrimaryButton onClick={accept} disabled={formDisabled}>
          {buttonLabel}
        </PrimaryButton>
        <Link href="/login" style={{ color: cockpitColors.textMuted, fontSize: typography.caption.fontSize, textAlign: "center" }}>
          Already have an account? Sign in
        </Link>
      </div>
    </InviteShell>
  );
}
