"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { cockpitColors, spacing, typography } from "@/design/tokens";
import PrimaryButton from "@/components/product/PrimaryButton";
import SecondaryButton from "@/components/product/SecondaryButton";

/**
 * Soft prompt for newly added packages — never force-redirect (redirects looped Home↔Ask).
 */
export default function PackageAskHomeBanner({
  businessId,
  packageIds = [],
}: {
  businessId: string;
  packageIds?: string[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [gone, setGone] = useState(false);
  const count = Array.isArray(packageIds) ? packageIds.length : 0;
  if (gone || !businessId) return null;

  async function dismiss() {
    setBusy(true);
    try {
      await fetch(`/api/businesses/${encodeURIComponent(businessId)}/builder/package-ask`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "clear" }),
      });
      setGone(true);
      router.refresh();
    } catch {
      setBusy(false);
    }
  }

  return (
    <div
      role="status"
      style={{
        marginBottom: spacing.lg,
        padding: spacing.md,
        borderRadius: 12,
        border: `1px solid ${cockpitColors.accent}`,
        background: "rgba(13, 148, 136, 0.08)",
        display: "grid",
        gap: spacing.sm,
      }}
    >
      <div style={{ fontWeight: 750, fontSize: 15, color: cockpitColors.textPrimary }}>
        New packages need a quick setup
      </div>
      <p style={{ ...typography.caption, margin: 0, color: cockpitColors.textSecondary, lineHeight: 1.45 }}>
        {count > 0
          ? `Answer a few questions about ${count === 1 ? "the package you added" : "the packages you added"} so VIBETech can wire them in. Your Home stays available — this is optional until you’re ready.`
          : "Answer a few questions so VIBETech can finish wiring what was added."}
      </p>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <PrimaryButton href={`/b/${encodeURIComponent(businessId)}/architect?packageAsk=1`}>
          Continue setup
        </PrimaryButton>
        <SecondaryButton onClick={busy ? undefined : () => void dismiss()}>
          {busy ? "Saving…" : "Dismiss for now"}
        </SecondaryButton>
        <Link
          href={`/b/${encodeURIComponent(businessId)}/integrations`}
          style={{ ...typography.caption, alignSelf: "center", color: cockpitColors.textMuted }}
        >
          Or keep using Integrations
        </Link>
      </div>
    </div>
  );
}
