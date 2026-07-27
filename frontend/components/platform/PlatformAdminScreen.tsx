"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import CreateBusinessModal from "@/components/platform/CreateBusinessModal";
import PrimaryButton from "@/components/product/PrimaryButton";
import StatusBadge from "@/components/product/StatusBadge";
import AdminVtPage from "@/components/admin/AdminVtPage";
import {
  VtCard,
  VtDockButton,
  VtDockLink,
  VtEmpty,
  VtPanel,
} from "@/components/product/VtChrome";
import { cockpitColors, spacing, typography } from "@/design/tokens";

type BusinessRow = {
  id: string;
  name: string;
  kind: string;
  ownerStatus: string;
  ownerInviteEmail?: string | null;
};

type DevInvite = {
  id: string;
  businessName: string;
  email: string;
  roleLabel: string;
  expiresAt: string;
  status: string;
  inviteUrl: string | null;
  hasLink: boolean;
};

function formatExpiry(expiresAt: string) {
  const date = new Date(expiresAt);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return date.toLocaleString();
}

export default function PlatformAdminScreen() {
  const [businesses, setBusinesses] = useState<BusinessRow[]>([]);
  const [devInvites, setDevInvites] = useState<DevInvite[]>([]);
  const [devMode, setDevMode] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [copyMessage, setCopyMessage] = useState<string | null>(null);
  const [generatingId, setGeneratingId] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    const res = await fetch("/api/platform/businesses");
    const data = await res.json();
    setBusinesses(data.businesses ?? []);

    const devRes = await fetch("/api/dev/invitations");
    if (devRes.ok) {
      const devData = await devRes.json();
      setDevMode(Boolean(devData.devMode));
      setDevInvites(devData.invitations ?? []);
    } else {
      setDevMode(false);
      setDevInvites([]);
    }

    setLoading(false);
  }

  useEffect(() => {
    refresh();
  }, []);

  function resolveInviteUrl(inviteUrl: string) {
    if (inviteUrl.startsWith("http://") || inviteUrl.startsWith("https://")) return inviteUrl;
    return `${window.location.origin}${inviteUrl.startsWith("/") ? "" : "/"}${inviteUrl}`;
  }

  async function copyInviteLink(inviteUrl: string) {
    await navigator.clipboard.writeText(resolveInviteUrl(inviteUrl));
    setCopyMessage("Invitation link copied.");
    window.setTimeout(() => setCopyMessage(null), 2500);
  }

  async function copyOwnerInviteLink(businessId: string) {
    setGeneratingId(businessId);
    const res = await fetch(`/api/platform/businesses/${businessId}/owner-invite`);
    const data = await res.json().catch(() => ({}));
    setGeneratingId(null);
    if (!res.ok || !data.inviteUrl) {
      setCopyMessage(data.error ?? "Could not load invitation link.");
      window.setTimeout(() => setCopyMessage(null), 3500);
      return;
    }
    await copyInviteLink(data.inviteUrl);
    if (!data.emailConfigured) {
      setCopyMessage("Invitation link copied. Email delivery is not configured on this deploy.");
      window.setTimeout(() => setCopyMessage(null), 4000);
    }
  }

  async function generateInviteLink(invitationId: string) {
    setGeneratingId(invitationId);
    const res = await fetch(`/api/dev/invitations/${invitationId}/generate-link`, { method: "POST" });
    const data = await res.json();
    setGeneratingId(null);
    if (!res.ok) {
      setCopyMessage(data.error ?? "Could not generate invitation link.");
      window.setTimeout(() => setCopyMessage(null), 3000);
      return;
    }
    await refresh();
    if (data.invitation?.inviteUrl) {
      await copyInviteLink(data.invitation.inviteUrl);
    }
  }

  return (
    <AdminVtPage
      title="Create & invite"
      eyebrow="Platform"
      dock={(
        <>
          <VtDockButton onClick={() => setShowCreate(true)}>+ Create business</VtDockButton>
          <VtDockLink href="/admin">Admin</VtDockLink>
          <VtDockLink href="/admin/businesses">Business directory</VtDockLink>
        </>
      )}
    >
      <VtPanel title="Businesses">
        {copyMessage ? (
          <p style={{ color: cockpitColors.accent, margin: "0 0 12px", fontWeight: 700 }}>{copyMessage}</p>
        ) : null}
        {loading ? (
          <p style={{ margin: 0, color: cockpitColors.textMuted }}>Loading…</p>
        ) : businesses.length === 0 ? (
          <VtEmpty label="No businesses yet." />
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {businesses.map((b) => (
              <VtCard key={b.id} padding={14}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: spacing.md,
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700, color: cockpitColors.textPrimary }}>{b.name}</div>
                    {b.ownerInviteEmail ? (
                      <div
                        style={{
                          marginTop: 4,
                          color: cockpitColors.textSecondary,
                          fontSize: typography.caption.fontSize,
                        }}
                      >
                        Invite: {b.ownerInviteEmail}
                      </div>
                    ) : null}
                    <div style={{ marginTop: 6, display: "flex", gap: spacing.sm, flexWrap: "wrap" }}>
                      {b.kind === "DEMO" ? <StatusBadge label="Demo" tone="info" /> : null}
                      <StatusBadge
                        label={b.ownerStatus}
                        tone={b.ownerStatus === "Active" ? "success" : "neutral"}
                      />
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 10, alignItems: "center", flexShrink: 0 }}>
                    {b.ownerStatus === "Owner invited" ? (
                      <button
                        type="button"
                        onClick={() => void copyOwnerInviteLink(b.id)}
                        style={{
                          border: "none",
                          background: "transparent",
                          color: cockpitColors.accent,
                          fontWeight: 700,
                          cursor: "pointer",
                          padding: 0,
                        }}
                      >
                        {generatingId === b.id ? "Loading…" : "Copy invite link"}
                      </button>
                    ) : null}
                    <Link
                      href={`/b/${b.id}/home`}
                      style={{ color: cockpitColors.accent, fontWeight: 700, textDecoration: "none" }}
                    >
                      Open
                    </Link>
                  </div>
                </div>
              </VtCard>
            ))}
          </div>
        )}
      </VtPanel>

      {devMode ? (
        <VtPanel title="Development invitations">
          <p style={{ ...typography.caption, color: cockpitColors.textMuted, margin: "0 0 12px" }}>
            Email is not configured locally. Pending invitations appear here so you can copy test links.
          </p>
          {copyMessage ? (
            <p style={{ color: cockpitColors.accent, margin: "0 0 12px", fontWeight: 700 }}>{copyMessage}</p>
          ) : null}
          {devInvites.length === 0 ? (
            <VtEmpty label="No pending invitations." />
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {devInvites.map((inv) => (
                <VtCard key={inv.id} padding={14} accent>
                  <div style={{ fontWeight: 700, color: cockpitColors.textPrimary }}>{inv.businessName}</div>
                  <div style={{ marginTop: 4, color: cockpitColors.textSecondary, fontSize: typography.caption.fontSize }}>
                    {inv.email} · {inv.roleLabel}
                  </div>
                  <div style={{ marginTop: 8, display: "flex", gap: spacing.sm, flexWrap: "wrap", alignItems: "center" }}>
                    <StatusBadge label={inv.status} tone={inv.status === "Pending" ? "neutral" : "info"} />
                    <span style={{ color: cockpitColors.textMuted, fontSize: typography.caption.fontSize }}>
                      Expires {formatExpiry(inv.expiresAt)}
                    </span>
                  </div>
                  <div style={{ marginTop: spacing.sm }}>
                    {inv.hasLink && inv.inviteUrl ? (
                      <PrimaryButton onClick={() => copyInviteLink(inv.inviteUrl!)}>Copy invitation link</PrimaryButton>
                    ) : (
                      <PrimaryButton onClick={() => generateInviteLink(inv.id)}>
                        {generatingId === inv.id ? "Generating…" : "Generate dev link"}
                      </PrimaryButton>
                    )}
                  </div>
                </VtCard>
              ))}
            </div>
          )}
        </VtPanel>
      ) : null}

      {showCreate ? <CreateBusinessModal onClose={() => setShowCreate(false)} onCreated={refresh} /> : null}
    </AdminVtPage>
  );
}
