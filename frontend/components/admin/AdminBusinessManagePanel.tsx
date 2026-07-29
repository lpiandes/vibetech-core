"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { cockpitColors } from "@/design/tokens";
import { VtCard, VtPanel, vtInputStyle } from "@/components/product/VtChrome";
import PrimaryButton from "@/components/product/PrimaryButton";
import SecondaryButton from "@/components/product/SecondaryButton";
import {
  listSalesPackagesForAdmin,
  readPurchasedPackagesFromConfig,
} from "../../../backend/core/platform/packages/SalesPackageCatalog.js";

type SalesPackageOption = {
  id: string;
  label: string;
  description: string;
  fullOs: boolean;
  honestyNote: string | null;
  commercialStatus?: string;
  sellable?: boolean;
};

export default function AdminBusinessManagePanel({
  businessId,
  initialName,
  status = "ACTIVE",
  initialPackageConfiguration = null,
}: {
  businessId: string;
  initialName: string;
  status?: string;
  initialPackageConfiguration?: Record<string, unknown> | null;
}) {
  const router = useRouter();
  const packages = useMemo(
    () => listSalesPackagesForAdmin() as SalesPackageOption[],
    [],
  );
  const [name, setName] = useState(initialName);
  const [purchasedPackages, setPurchasedPackages] = useState<string[]>(
    () => readPurchasedPackagesFromConfig(initialPackageConfiguration ?? {}),
  );
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const archived = String(status).toUpperCase() === "ARCHIVED";

  function togglePackage(id: string) {
    setPurchasedPackages((current) => {
      if (current.includes(id)) {
        return current.filter((entry) => entry !== id);
      }
      // Full OS can combine with add-ons (e.g. AI Prospecting).
      return [...current, id];
    });
  }

  async function saveName() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/platform/businesses/${encodeURIComponent(businessId)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not rename business.");
        return;
      }
      setMessage("Name updated.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not rename business.");
    } finally {
      setBusy(false);
    }
  }

  async function savePackages() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/platform/businesses/${encodeURIComponent(businessId)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ purchasedPackages }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not update packages.");
        return;
      }
      setMessage("Purchased packages updated. On next Home visit, Ask VIBETech opens automatically for any newly added packages.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update packages.");
    } finally {
      setBusy(false);
    }
  }

  async function archiveBusiness() {
    const confirmed = window.confirm(
      `Delete “${initialName}”? It will leave active directories. Data is archived, not hard-wiped.`,
    );
    if (!confirmed) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/platform/businesses/${encodeURIComponent(businessId)}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not delete business.");
        return;
      }
      setMessage("Business deleted from active directories.");
      router.push("/admin/businesses");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete business.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <VtPanel title="Manage business">
      <div style={{ display: "grid", gap: 16 }}>
        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ color: cockpitColors.textMuted, fontWeight: 800, fontSize: 12, letterSpacing: "0.06em", textTransform: "uppercase" }}>
            Business name
          </span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={busy || archived}
            style={vtInputStyle}
          />
        </label>

        <div style={{ display: "grid", gap: 8 }}>
          <span style={{ color: cockpitColors.textMuted, fontWeight: 800, fontSize: 12, letterSpacing: "0.06em", textTransform: "uppercase" }}>
            Purchased packages
          </span>
          {packages.map((pkg) => {
            const checked = purchasedPackages.includes(pkg.id);
            return (
              <VtCard key={pkg.id} padding={12} accent={checked}>
                <label
                  style={{
                    display: "flex",
                    gap: 10,
                    alignItems: "flex-start",
                    fontSize: 13,
                    opacity: archived ? 0.6 : 1,
                    cursor: archived || busy ? "default" : "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={busy || archived}
                    onChange={() => togglePackage(pkg.id)}
                    style={{ marginTop: 3 }}
                  />
                  <span>
                    <strong style={{ fontSize: 14 }}>{pkg.label}</strong>
                    {pkg.commercialStatus && pkg.commercialStatus !== "product" ? (
                      <span style={{ marginLeft: 6, fontSize: 11, color: cockpitColors.textMuted }}>
                        ({pkg.commercialStatus}{pkg.sellable === false ? ", not sellable" : ""})
                      </span>
                    ) : null}
                    <span style={{ display: "block", color: cockpitColors.textMuted, fontWeight: 400, marginTop: 2, lineHeight: 1.45 }}>
                      {pkg.description}
                      {pkg.honestyNote ? ` — ${pkg.honestyNote}` : ""}
                    </span>
                  </span>
                </label>
              </VtCard>
            );
          })}
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <PrimaryButton
            onClick={() => void saveName()}
            disabled={busy || archived || !name.trim() || name.trim() === initialName}
          >
            Save name
          </PrimaryButton>
          <SecondaryButton
            onClick={() => void savePackages()}
            disabled={busy || archived || purchasedPackages.length === 0}
          >
            Save packages
          </SecondaryButton>
          {!archived ? (
            <SecondaryButton onClick={() => void archiveBusiness()} disabled={busy}>
              Delete business
            </SecondaryButton>
          ) : null}
        </div>

        {message ? (
          <p style={{ margin: 0, color: cockpitColors.handled, fontSize: 13 }}>{message}</p>
        ) : null}
        {error ? (
          <p style={{ margin: 0, color: "#b91c1c", fontSize: 13 }}>{error}</p>
        ) : null}
        <p style={{ margin: 0, color: cockpitColors.textMuted, fontSize: 12, lineHeight: 1.45 }}>
          Saving packages updates Launch and nav immediately. Newly added packages open Ask VIBETech on the owner’s next Home visit (blocking until answered). Removals take effect without Ask.
        </p>
      </div>
    </VtPanel>
  );
}
