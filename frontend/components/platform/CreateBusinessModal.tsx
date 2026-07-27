"use client";

import { useMemo, useState } from "react";

import SimpleModal from "@/components/product/SimpleModal";
import PrimaryButton from "@/components/product/PrimaryButton";
import SecondaryButton from "@/components/product/SecondaryButton";
import { typography, cockpitColors } from "@/design/tokens";
import { listSellableSalesPackagesForAdmin } from "../../../backend/core/platform/packages/SalesPackageCatalog.js";

type SalesPackageOption = {
  id: string;
  label: string;
  description: string;
  fullOs: boolean;
  honestyNote: string | null;
  commercialStatus?: string;
  sellable?: boolean;
};

const fieldStyle = {
  padding: "10px 12px",
  borderRadius: 10,
  border: `1px solid ${cockpitColors.panelBorder}`,
  fontSize: 15,
  fontFamily: "inherit" as const,
  color: cockpitColors.textPrimary,
  background: "#fff",
  width: "100%",
  boxSizing: "border-box" as const,
};

export default function CreateBusinessModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const packages = useMemo(
    () => listSellableSalesPackagesForAdmin() as SalesPackageOption[],
    [],
  );
  const [name, setName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [purchasedPackages, setPurchasedPackages] = useState<string[]>(["ai_business_os"]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function togglePackage(id: string) {
    const selected = packages.find((pkg) => pkg.id === id);
    setPurchasedPackages((current) => {
      if (current.includes(id)) {
        return current.filter((entry) => entry !== id);
      }
      if (selected?.fullOs) {
        return [id];
      }
      const withoutFullOs = current.filter((entry) => {
        const pkg = packages.find((row) => row.id === entry);
        return !pkg?.fullOs;
      });
      return [...withoutFullOs, id];
    });
  }

  async function submit() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/platform/businesses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, ownerEmail, purchasedPackages }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "Could not create business.");
      return;
    }
    setSuccess(
      `Created ${data.business.name}. Owner invitation ${data.invitation.emailSent ? "sent" : "recorded for development"}.`,
    );
    onCreated();
  }

  return (
    <SimpleModal
      title="Create business"
      onClose={onClose}
      maxWidth={520}
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
        <p style={{ ...typography.body, color: cockpitColors.textSecondary, margin: 0 }}>{success}</p>
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
                Purchased packages
              </div>
              <p
                style={{
                  fontSize: 12,
                  color: cockpitColors.textSecondary,
                  margin: "4px 0 0",
                  lineHeight: 1.4,
                }}
              >
                Check what they bought. Hover a row for the short scope note.
              </p>
            </div>
            <div
              style={{
                border: `1px solid ${cockpitColors.panelBorder}`,
                borderRadius: 12,
                overflow: "hidden",
                background: "#fff",
              }}
            >
              {packages.map((pkg, index) => {
                const checked = purchasedPackages.includes(pkg.id);
                return (
                  <label
                    key={pkg.id}
                    title={pkg.description}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      margin: 0,
                      padding: "11px 14px",
                      cursor: "pointer",
                      background: checked ? "rgba(15,118,110,0.07)" : "#fff",
                      borderTop: index === 0 ? "none" : `1px solid ${cockpitColors.panelBorder}`,
                      position: "relative",
                      zIndex: 1,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => togglePackage(pkg.id)}
                      style={{
                        width: 15,
                        height: 15,
                        flexShrink: 0,
                        margin: 0,
                        accentColor: "#0f766e",
                      }}
                    />
                    <span
                      style={{
                        fontSize: 14,
                        fontWeight: checked ? 600 : 500,
                        lineHeight: 1.3,
                        color: cockpitColors.textPrimary,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {pkg.label}
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
