"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import CreateBusinessModal from "@/components/platform/CreateBusinessModal";
import PrimaryButton from "@/components/product/PrimaryButton";
import StatusBadge from "@/components/product/StatusBadge";
import { ProductPage, PageHeader } from "@/components/product";
import { cockpitColors, spacing, typography, radius } from "@/design/tokens";

type BusinessRow = {
  id: string;
  name: string;
  kind: string;
  ownerStatus: string;
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
    <ProductPage>
      <PageHeader title="Businesses" action={<PrimaryButton onClick={() => setShowCreate(true)}>+ Create business</PrimaryButton>} />

      {loading ? (
        <p style={{ color: cockpitColors.textMuted }}>Loading…</p>
      ) : businesses.length === 0 ? (
        <p style={{ color: cockpitColors.textSecondary }}>No businesses yet.</p>
      ) : (
        <div style={{ borderRadius: radius.large, border: `1px solid ${cockpitColors.panelBorder}`, overflow: "hidden", background: cockpitColors.panel }}>
          {businesses.map((b, index) => (
            <div
              key={b.id}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: spacing.md,
                padding: `${spacing.md} ${spacing.lg}`,
                borderBottom: index < businesses.length - 1 ? `1px solid ${cockpitColors.panelBorder}` : undefined,
              }}
            >
              <div>
                <div style={{ fontWeight: 600, color: cockpitColors.textPrimary }}>{b.name}</div>
                <div style={{ marginTop: 4, display: "flex", gap: spacing.sm, flexWrap: "wrap" }}>
                  {b.kind === "DEMO" ? <StatusBadge label="Demo" tone="info" /> : null}
                  <StatusBadge label={b.ownerStatus} tone={b.ownerStatus === "Active" ? "success" : "neutral"} />
                </div>
              </div>
              <Link href={`/b/${b.id}/home`} style={{ color: cockpitColors.accent, fontWeight: 600, textDecoration: "none" }}>
                Open
              </Link>
            </div>
          ))}
        </div>
      )}

      {devMode ? (
        <section style={{ marginTop: spacing.xl }}>
          <h2 style={{ fontSize: typography.sectionTitle.fontSize, marginBottom: spacing.sm }}>Development invitations</h2>
          <p style={{ ...typography.caption, color: cockpitColors.textMuted, marginTop: 0 }}>
            Email is not configured locally. Pending invitations appear here so you can copy test links.
          </p>
          {copyMessage ? <p style={{ color: cockpitColors.accent, margin: `${spacing.sm} 0` }}>{copyMessage}</p> : null}
          {devInvites.length === 0 ? (
            <p style={{ color: cockpitColors.textSecondary }}>No pending invitations.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: spacing.sm }}>
              {devInvites.map((inv) => (
                <div
                  key={inv.id}
                  style={{
                    padding: spacing.md,
                    border: `1px solid ${cockpitColors.panelBorder}`,
                    borderRadius: 8,
                    background: cockpitColors.panel,
                  }}
                >
                  <div style={{ fontWeight: 600, color: cockpitColors.textPrimary }}>{inv.businessName}</div>
                  <div style={{ marginTop: 4, color: cockpitColors.textSecondary, fontSize: typography.caption.fontSize }}>
                    {inv.email} · {inv.roleLabel}
                  </div>
                  <div style={{ marginTop: 4, display: "flex", gap: spacing.sm, flexWrap: "wrap", alignItems: "center" }}>
                    <StatusBadge label={inv.status} tone={inv.status === "Pending" ? "neutral" : "info"} />
                    <span style={{ color: cockpitColors.textMuted, fontSize: typography.caption.fontSize }}>
                      Expires {formatExpiry(inv.expiresAt)}
                    </span>
                  </div>
                  <div style={{ marginTop: spacing.sm, display: "flex", gap: spacing.sm, flexWrap: "wrap" }}>
                    {inv.hasLink && inv.inviteUrl ? (
                      <PrimaryButton onClick={() => copyInviteLink(inv.inviteUrl!)}>Copy invitation link</PrimaryButton>
                    ) : (
                      <PrimaryButton onClick={() => generateInviteLink(inv.id)}>
                        {generatingId === inv.id ? "Generating…" : "Generate dev link"}
                      </PrimaryButton>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      ) : null}

      {showCreate ? <CreateBusinessModal onClose={() => setShowCreate(false)} onCreated={refresh} /> : null}
    </ProductPage>
  );
}
