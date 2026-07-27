"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { cockpitColors } from "@/design/tokens";

/**
 * Platform-admin delete (archives the business — leaves active directories).
 */
export default function AdminDeleteBusinessButton({
  businessId,
  businessName,
  onDeleted,
  label = "Delete",
}: {
  businessId: string;
  businessName: string;
  onDeleted?: () => void;
  label?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function deleteBusiness() {
    const confirmed = window.confirm(
      `Delete “${businessName}”? It will leave active directories. Data is archived, not hard-wiped.`,
    );
    if (!confirmed) return;

    setBusy(true);
    try {
      const res = await fetch(`/api/platform/businesses/${encodeURIComponent(businessId)}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        window.alert(data.error ?? "Could not delete business.");
        return;
      }
      if (onDeleted) {
        onDeleted();
      } else {
        router.refresh();
      }
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Could not delete business.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void deleteBusiness()}
      disabled={busy}
      style={{
        border: "none",
        background: "transparent",
        color: "#b91c1c",
        fontWeight: 700,
        cursor: busy ? "wait" : "pointer",
        padding: 0,
        fontSize: "inherit",
        fontFamily: "inherit",
      }}
    >
      {busy ? "Deleting…" : label}
    </button>
  );
}
