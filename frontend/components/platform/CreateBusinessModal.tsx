"use client";

import { useMemo, useState } from "react";

import SimpleModal from "@/components/product/SimpleModal";
import PrimaryButton from "@/components/product/PrimaryButton";
import SecondaryButton from "@/components/product/SecondaryButton";
import { spacing, typography, cockpitColors } from "@/design/tokens";
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
    setSuccess(`Created ${data.business.name}. Owner invitation ${data.invitation.emailSent ? "sent" : "recorded for development"}.`);
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
        <p style={{ ...typography.body, color: cockpitColors.textSecondary, margin: 0 }}>{success}</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: spacing.md }}>
          <label style={{ display: "flex", flexDirection: "column", gap: spacing.xs }}>
            <span style={{ fontWeight: 700, fontSize: typography.caption.fontSize }}>Business name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={{
                padding: `${spacing.sm} ${spacing.md}`,
                borderRadius: 10,
                border: `1px solid ${cockpitColors.panelBorder}`,
                fontSize: 15,
              }}
            />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: spacing.xs }}>
            <span style={{ fontWeight: 700, fontSize: typography.caption.fontSize }}>Owner email</span>
            <input
              type="email"
              value={ownerEmail}
              onChange={(e) => setOwnerEmail(e.target.value)}
              style={{
                padding: `${spacing.sm} ${spacing.md}`,
                borderRadius: 10,
                border: `1px solid ${cockpitColors.panelBorder}`,
                fontSize: 15,
              }}
            />
          </label>
          <div style={{ display: "flex", flexDirection: "column", gap: spacing.sm }}>
            <div style={{ fontWeight: 700, fontSize: typography.caption.fontSize }}>Purchased packages</div>
            <p style={{ fontSize: 13, color: cockpitColors.textSecondary, margin: 0, lineHeight: 1.45 }}>
              Check what they bought on the sales sheet. Discovery and the workspace stay inside this scope.
            </p>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
                maxHeight: 320,
                overflowY: "auto",
                paddingRight: 4,
              }}
            >
              {packages.map((pkg) => {
                const checked = purchasedPackages.includes(pkg.id);
                return (
                  <label
                    key={pkg.id}
                    style={{
                      display: "flex",
                      gap: 12,
                      alignItems: "flex-start",
                      cursor: "pointer",
                      padding: "12px 14px",
                      borderRadius: 12,
                      border: `2px solid ${checked ? "rgba(15,118,110,0.45)" : cockpitColors.panelBorder}`,
                      background: checked ? "rgba(15,118,110,0.06)" : "#fff",
                      minHeight: 56,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => togglePackage(pkg.id)}
                      style={{ marginTop: 3, flexShrink: 0, width: 16, height: 16 }}
                    />
                    <span style={{ minWidth: 0, flex: 1 }}>
                      <span
                        style={{
                          display: "block",
                          fontWeight: 650,
                          fontSize: 14,
                          fontFamily: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                          color: cockpitColors.textPrimary,
                          lineHeight: 1.35,
                        }}
                      >
                        {pkg.label}
                      </span>
                      <span
                        style={{
                          display: "block",
                          marginTop: 4,
                          fontSize: 12,
                          color: cockpitColors.textSecondary,
                          lineHeight: 1.45,
                          fontWeight: 400,
                        }}
                      >
                        {pkg.description}
                        {pkg.honestyNote ? ` ${pkg.honestyNote}` : ""}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
          {error ? <p style={{ color: "#dc2626", margin: 0 }}>{error}</p> : null}
        </div>
      )}
    </SimpleModal>
  );
}
