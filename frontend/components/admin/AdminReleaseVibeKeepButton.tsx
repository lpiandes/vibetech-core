"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function AdminReleaseVibeKeepButton({
  businessId,
  businessName,
}: {
  businessId: string;
  businessName: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function release() {
    const confirmed = window.confirm(
      `Release “${businessName}”? The book is archived and the owner’s email can sign up again. History is kept.`,
    );
    if (!confirmed) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/insurance/release", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        window.alert(data.message || data.error || "Could not release that signup.");
        return;
      }
      router.refresh();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Could not release that signup.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button type="button" variant="destructive" size="sm" disabled={busy} onClick={() => void release()}>
      {busy ? "Releasing…" : "Release signup"}
    </Button>
  );
}
