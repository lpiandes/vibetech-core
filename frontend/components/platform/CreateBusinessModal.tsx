"use client";

import { useMemo, useState } from "react";

import SimpleModal from "@/components/product/SimpleModal";
import PrimaryButton from "@/components/product/PrimaryButton";
import SecondaryButton from "@/components/product/SecondaryButton";
import { typography, cockpitColors } from "@/design/tokens";
import { listSellableSalesPackagesForAdmin } from "../../../../backend/core/platform/packages/SalesPackageCatalog.js";

const fieldStyle = {
  padding: "10px 12px",
  borderRadius: 10,
  border: `1px solid ${cockpitColors.panelBorder}`,
  fontSize: 15,
  fontFamily: "inherit" as const,
  color: cockpitColors.textPrimary,
  background: cockpitColors.panel,
  width: "100%",
  boxSizing: "border-box" as const,
};

type CreateSuccess = {
  businessName: string;
  ownerEmail: string;
  emailSent: boolean;
  inviteUrl: string | null;
  deliveryMessage: string | null;
};

export default function CreateBusinessModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const sellablePackages = useMemo(() => listSellableSalesPackagesForAdmin(), []);
  const [name, setName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [purchasedPackages, setPurchasedPackages] = useState<string[]>(["managed_revenue_follow_through"]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<CreateSuccess | null>(null);
  const [copied, setCopied] = useState(false);

  function resolveInviteUrl(inviteUrl: string) {
    if (inviteUrl.startsWith("http://") || inviteUrl.startsWith("https://")) return inviteUrl;
    return `${window.location.origin}${inviteUrl.startsWith("/") ? "" : "/"}${inviteUrl}`;
  }

  async function copyInviteLink(inviteUrl: string) {
    await navigator.clipboard.writeText(resolveInviteUrl(inviteUrl));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2500);
  }

  function togglePackage(id: string) {
    setPurchasedPackages((prev) => {
      if (prev.includes(id)) {
        if (prev.length === 1) return prev;
        return prev.filter((row) => row !== id);
      }
      return [...prev, id];
    });
  }

  async function submit() {
    if (!purchasedPackages.length) {
      setError("Select at least one package.");
      return;
    }
    setBusy(true);
    setError(null);
    const res = await fetch("/api/platform/businesses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        ownerEmail,
        purchasedPackages,
      }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "Could not create business.");
      return;
    }
    setSuccess({
      businessName: data.business?.name ?? name,
      ownerEmail: data.invitation?.email ?? ownerEmail,
      emailSent: Boolean(data.invitation?.emailSent),
      inviteUrl: data.invitation?.inviteUrl ?? null,
      deliveryMessage: data.invitation?.deliveryMessage ?? null,
    });
    onCreated();
  }

  return (
    <SimpleModal
      title="Create business"
      onClose={onClose}
      maxWidth={560}
      footer={
        success ? (
          <PrimaryButton onClick={onClose}>Done</PrimaryButton>
        ) : (
          <>
            <SecondaryButton onClick={onClose}>Cancel</SecondaryButton>
            <PrimaryButton onClick={submit}>{busy ? "Creating…" : "Create & invite owner"}</PrimaryButton>
          </>
        )
      }
    >
      {success ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <p style={{ ...typography.body, color: cockpitColors.textPrimary, margin: 0 }}>
            Created <strong>{success.businessName}</strong>.
          </p>
          <p style={{ margin: 0, fontSize: 14, color: cockpitColors.textSecondary, lineHeight: 1.45 }}>
            {success.emailSent ? (
              <>
                Invitation email sent to <strong>{success.ownerEmail}</strong>. Check that inbox
                (and Spam / Promotions), not a different Gmail account.
              </>
            ) : (
              <>
                Invitation saved for <strong>{success.ownerEmail}</strong>, but email was not sent
                {success.deliveryMessage ? ` (${success.deliveryMessage})` : ""}. Copy the link
                below and share it with the owner.
              </>
            )}
          </p>
          {success.inviteUrl ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <code
                style={{
                  display: "block",
                  padding: "10px 12px",
                  borderRadius: 10,
                  background: "#f8fafc",
                  border: `1px solid ${cockpitColors.panelBorder}`,
                  fontSize: 12,
                  wordBreak: "break-all",
                  color: cockpitColors.textPrimary,
                }}
              >
                {resolveInviteUrl(success.inviteUrl)}
              </code>
              <PrimaryButton onClick={() => void copyInviteLink(success.inviteUrl!)}>
                {copied ? "Copied" : "Copy invitation link"}
              </PrimaryButton>
            </div>
          ) : null}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ fontWeight: 600, fontSize: 13, color: cockpitColors.textPrimary }}>
              Business name
            </span>
            <input value={name} onChange={(e) => setName(e.target.value)} style={fieldStyle} />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ fontWeight: 600, fontSize: 13, color: cockpitColors.textPrimary }}>
              Owner email
            </span>
            <input
              type="email"
              value={ownerEmail}
              onChange={(e) => setOwnerEmail(e.target.value)}
              style={fieldStyle}
            />
          </label>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 13, color: cockpitColors.textPrimary }}>
                Packages
              </div>
              <p
                style={{
                  fontSize: 12,
                  color: cockpitColors.textSecondary,
                  margin: "4px 0 0",
                  lineHeight: 1.4,
                }}
              >
                Select Wave A sellable packages. Managed Revenue Follow-Through is recommended for design partners.
              </p>
            </div>
            <div style={{ display: "grid", gap: 8 }}>
              {sellablePackages.map((pkg: { id: string; label: string; description?: string; honestyNote?: string | null }) => {
                const checked = purchasedPackages.includes(pkg.id);
                return (
                  <label
                    key={pkg.id}
                    style={{
                      border: `1px solid ${cockpitColors.panelBorder}`,
                      borderRadius: 12,
                      background: checked ? "rgba(34,211,238,0.08)" : cockpitColors.panel,
                      padding: "12px 14px",
                      display: "grid",
                      gridTemplateColumns: "auto 1fr",
                      gap: 10,
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => togglePackage(pkg.id)}
                      style={{ marginTop: 3 }}
                    />
                    <span>
                      <strong style={{ fontSize: 14, color: cockpitColors.textPrimary }}>{pkg.label}</strong>
                      <span style={{ display: "block", fontSize: 12, color: cockpitColors.textSecondary, lineHeight: 1.45, marginTop: 2 }}>
                        {pkg.description || pkg.honestyNote || ""}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
          {error ? (
            <p style={{ color: "#dc2626", margin: 0, fontSize: 13 }}>{error}</p>
          ) : null}
        </div>
      )}
    </SimpleModal>
  );
}
