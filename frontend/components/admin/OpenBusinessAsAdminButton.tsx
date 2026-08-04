"use client";

import { useState } from "react";
import PrimaryButton from "@/components/product/PrimaryButton";
import { cockpitColors } from "@/design/tokens";
import { formatProductErrorMessage } from "@/lib/platform/productErrors";
import { hardNavigateToBusinessHome } from "@/lib/builder/hardNavigateToBusinessHome";

/**
 * One-click: elevated support enter → client's real Home (hard navigation).
 * Soft client navigations can flash forbidden/home when support session
 * isn't ready in the layout request — always re-enter, then full page load.
 */
export default function OpenBusinessAsAdminButton({
  businessId,
  businessName,
  alreadyActive = false,
}: {
  businessId: string;
  businessName: string;
  alreadyActive?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const homeHref = `/b/${encodeURIComponent(businessId)}/home`;

  async function openWorkspace() {
    setBusy(true);
    setError(null);
    try {
      // Always refresh support access — don't trust a stale "already active" banner.
      const res = await fetch("/api/admin/support/enter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId,
          reason: `Platform admin reviewing ${businessName}`,
          mode: "elevated",
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setError(
          formatProductErrorMessage(
            data.productError ?? data.reason ?? data.error ?? "Could not open business",
          ),
        );
        return;
      }
      hardNavigateToBusinessHome(homeHref);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open business");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <PrimaryButton onClick={() => void openWorkspace()} disabled={busy}>
        {busy ? "Opening…" : alreadyActive ? "Continue to business" : "Open business"}
      </PrimaryButton>
      {error ? <div style={{ color: "#b91c1c", fontSize: 13 }}>{error}</div> : null}
      <div style={{ color: cockpitColors.textMuted, fontSize: 13, lineHeight: 1.45 }}>
        Opens their real Home with an <strong>Admin view</strong> banner. Full edit, audited — you are not made a permanent owner.
      </div>
    </div>
  );
}
