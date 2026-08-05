"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { cockpitColors, spacing } from "@/design/tokens";

type Match = {
  id: string;
  name: string;
  kind?: string;
  email?: string;
};

/**
 * Resolves inbox thread email/name to a CRM contact and links into People.
 */
export default function InboxCrmContactLink({
  businessId,
  email,
  displayName,
}: {
  businessId: string;
  email?: string | null;
  displayName?: string | null;
}) {
  const [match, setMatch] = useState<Match | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/businesses/${encodeURIComponent(businessId)}/contacts`);
        const data = await res.json().catch(() => ({}));
        if (cancelled || !data.ok) return;
        const contacts = data.contacts ?? [];
        const emailLc = String(email ?? "").trim().toLowerCase();
        const nameLc = String(displayName ?? "").trim().toLowerCase();
        const found =
          contacts.find((c: Match) => emailLc && String(c.email ?? "").toLowerCase() === emailLc)
          ?? contacts.find((c: Match) => nameLc && String(c.name ?? "").toLowerCase() === nameLc)
          ?? null;
        setMatch(found);
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [businessId, email, displayName]);

  const peopleHref = `/b/${encodeURIComponent(businessId)}/people`;

  if (!loaded) return null;

  return (
    <div
      style={{
        marginTop: spacing.sm,
        padding: "10px 12px",
        borderRadius: 10,
        border: `1px solid ${cockpitColors.panelBorder}`,
        background: cockpitColors.panelElevated,
        fontSize: 13,
        color: cockpitColors.textPrimary,
      }}
    >
      {match ? (
        <>
          <div style={{ fontWeight: 750 }}>CRM: {match.name}</div>
          <div style={{ color: cockpitColors.textSecondary, marginTop: 2 }}>
            {match.kind || "contact"}{match.email ? ` · ${match.email}` : ""}
          </div>
          <Link href={peopleHref} style={{ fontWeight: 800, color: cockpitColors.accent, textDecoration: "none", display: "inline-block", marginTop: 6 }}>
            Open in People →
          </Link>
        </>
      ) : (
        <>
          <div style={{ fontWeight: 650 }}>No CRM contact matched yet</div>
          <Link href={peopleHref} style={{ fontWeight: 800, color: cockpitColors.accent, textDecoration: "none", display: "inline-block", marginTop: 6 }}>
            Add in People →
          </Link>
        </>
      )}
    </div>
  );
}
