"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import SimpleModal from "@/components/product/SimpleModal";
import PrimaryButton from "@/components/product/PrimaryButton";
import SecondaryButton from "@/components/product/SecondaryButton";
import { copyInviteLink } from "@/lib/platform/inviteLinks";
import { cockpitColors, spacing, typography } from "@/design/tokens";
import { formatProductErrorMessage } from "@/lib/platform/productErrors";

const INVITE_ROLES = [
  { value: "ADMIN", label: "Administrator" },
  { value: "MANAGER", label: "Manager" },
  { value: "EMPLOYEE", label: "Staff member" },
  { value: "VIEWER", label: "View only" },
];

export default function InvitePersonDialog({
  businessId,
  showDevInviteLinks = false,
  audienceLabel = "teammate",
  onClose,
  onSent,
}: {
  businessId: string;
  showDevInviteLinks?: boolean;
  audienceLabel?: string;
  onClose: () => void;
  onSent: () => void;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("EMPLOYEE");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [devLink, setDevLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function send() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/businesses/${businessId}/invitations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, role }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(formatProductErrorMessage(data.productError ?? data.error ?? "Could not send invitation."));
      return;
    }
    if (!data.emailSent && data.inviteUrl) {
      setDevLink(data.inviteUrl);
      router.refresh();
      return;
    }
    if (!data.emailSent) {
      setError(formatProductErrorMessage(data.deliveryMessage ?? data.delivery?.reason ?? "email_not_configured"));
      router.refresh();
      return;
    }
    onSent();
    router.refresh();
    onClose();
  }

  async function copyLink() {
    if (!devLink) return;
    await copyInviteLink(devLink);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2500);
  }

  return (
    <SimpleModal
      title={`Invite ${audienceLabel}`}
      onClose={onClose}
      footer={
        devLink ? (
          <>
            <SecondaryButton onClick={onClose}>Done</SecondaryButton>
            {showDevInviteLinks ? (
              <PrimaryButton onClick={() => void copyLink()}>{copied ? "Copied!" : "Copy invite link"}</PrimaryButton>
            ) : null}
          </>
        ) : (
          <>
            <SecondaryButton onClick={onClose}>Cancel</SecondaryButton>
            <PrimaryButton onClick={() => void send()} disabled={busy || !email.trim()}>
              {busy ? "Sending…" : "Send invite"}
            </PrimaryButton>
          </>
        )
      }
    >
      {devLink ? (
        <div style={{ display: "flex", flexDirection: "column", gap: spacing.md }}>
          <p style={{ ...typography.body, color: cockpitColors.textPrimary, margin: 0, lineHeight: 1.45 }}>
            Invitation sent to <strong>{email}</strong>.
          </p>
          {showDevInviteLinks ? (
            <p style={{ ...typography.caption, color: cockpitColors.textSecondary, margin: 0, lineHeight: 1.5 }}>
              Email delivery is not set up in this environment. Copy the invite link below and share it directly.
            </p>
          ) : (
            <p style={{ ...typography.caption, color: cockpitColors.textSecondary, margin: 0, lineHeight: 1.5 }}>
              They will receive an email with instructions to join your staff workspace.
            </p>
          )}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: spacing.md }}>
          <label style={{ display: "flex", flexDirection: "column", gap: spacing.xs }}>
            <span style={{ fontWeight: 600, fontSize: typography.caption.fontSize }}>Email address</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@company.com"
              style={{ padding: `${spacing.sm} ${spacing.md}`, borderRadius: 8, border: `1px solid ${cockpitColors.panelBorder}` }}
            />
          </label>
          <p style={{ ...typography.caption, color: cockpitColors.textMuted, margin: 0, lineHeight: 1.5 }}>
            This grants access to the business for staff, coaches, or administrators. It does not add a player or family to a sports roster.
          </p>
          <label style={{ display: "flex", flexDirection: "column", gap: spacing.xs }}>
            <span style={{ fontWeight: 600, fontSize: typography.caption.fontSize }}>Role</span>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              style={{ padding: `${spacing.sm} ${spacing.md}`, borderRadius: 8, border: `1px solid ${cockpitColors.panelBorder}` }}
            >
              {INVITE_ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>
          {error ? <p style={{ color: "#dc2626", margin: 0 }}>{error}</p> : null}
        </div>
      )}
    </SimpleModal>
  );
}
