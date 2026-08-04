"use client";

import { useState } from "react";
import PrimaryButton from "@/components/product/PrimaryButton";
import SecondaryButton from "@/components/product/SecondaryButton";
import { cockpitColors } from "@/design/tokens";
import { copyInviteLink } from "@/lib/platform/inviteLinks";

/**
 * Always-available owner invite recovery on the admin business page:
 * copy accept link, or resend the invite email.
 */
export default function AdminOwnerInviteActions({
  businessId,
  ownerStatus,
}: {
  businessId: string;
  ownerStatus?: string | null;
}) {
  const [busy, setBusy] = useState<"copy" | "send" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const invited = String(ownerStatus ?? "").toLowerCase().includes("invited");

  function flash(ok: string) {
    setMessage(ok);
    setError(null);
    window.setTimeout(() => setMessage(null), 3500);
  }

  async function copyLink() {
    setBusy("copy");
    setError(null);
    try {
      const res = await fetch(`/api/platform/businesses/${encodeURIComponent(businessId)}/owner-invite`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.inviteUrl) {
        setError(String(data.error ?? "No pending owner invitation."));
        return;
      }
      await copyInviteLink(String(data.inviteUrl));
      flash(
        data.emailConfigured === false
          ? "Invite link copied. Email delivery is not configured on this deploy."
          : "Invite link copied.",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not copy invite link.");
    } finally {
      setBusy(null);
    }
  }

  async function sendInvite() {
    setBusy("send");
    setError(null);
    try {
      const res = await fetch(`/api/platform/businesses/${encodeURIComponent(businessId)}/owner-invite`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(String(data.error ?? "Could not send invite."));
        return;
      }
      if (data.inviteUrl) {
        await copyInviteLink(String(data.inviteUrl));
      }
      flash(
        data.emailSent
          ? "Invite email sent (link also copied)."
          : String(data.deliveryMessage ?? "Invite link copied. Email was not sent."),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send invite.");
    } finally {
      setBusy(null);
    }
  }

  if (!invited && ownerStatus === "Active") {
    return (
      <div style={{ color: cockpitColors.textMuted, fontSize: 13, marginTop: 8 }}>
        Owner is active — no pending invite.
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
      <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", color: cockpitColors.textMuted }}>
        Owner invite
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        <SecondaryButton onClick={() => void copyLink()} disabled={busy !== null}>
          {busy === "copy" ? "Copying…" : "Copy invite link"}
        </SecondaryButton>
        <PrimaryButton onClick={() => void sendInvite()} disabled={busy !== null}>
          {busy === "send" ? "Sending…" : "Send invite email"}
        </PrimaryButton>
      </div>
      {message ? <div style={{ color: cockpitColors.accent, fontSize: 13, fontWeight: 700 }}>{message}</div> : null}
      {error ? <div style={{ color: "#b91c1c", fontSize: 13 }}>{error}</div> : null}
    </div>
  );
}
