"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useBusinessScope } from "@/lib/platform/BusinessScopeContext";
import { cockpitColors, spacing, radius, typography } from "@/design/tokens";

type BusinessRow = { id: string; name: string; role?: string | null };

/**
 * In-shell business switcher — membership only, no cross-tenant leakage.
 */
export default function BusinessSwitcher() {
  const scope = useBusinessScope();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [businesses, setBusinesses] = useState<BusinessRow[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch("/api/me/businesses", { cache: "no-store" });
        const data = await response.json();
        if (!response.ok || !data.ok || cancelled) return;
        setBusinesses(Array.isArray(data.businesses) ? data.businesses : []);
        setIsAdmin(Boolean(data.isPlatformAdmin));
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return businesses;
    return businesses.filter((row) => row.name.toLowerCase().includes(q));
  }, [businesses, query]);

  return (
    <div style={{ position: "relative" }}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        style={{
          border: `1px solid ${cockpitColors.panelBorder}`,
          background: cockpitColors.panelElevated,
          borderRadius: radius.medium,
          padding: "6px 10px",
          cursor: "pointer",
          fontWeight: 650,
          color: cockpitColors.textPrimary,
          fontSize: typography.caption.fontSize,
          maxWidth: 220,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {scope.businessName || "Business"}
      </button>
      {open ? (
        <div
          role="listbox"
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            minWidth: 280,
            maxWidth: 360,
            background: cockpitColors.panel,
            border: `1px solid ${cockpitColors.panelBorder}`,
            borderRadius: radius.large,
            boxShadow: "0 18px 40px rgba(15,23,42,.12)",
            padding: spacing.sm,
            zIndex: 40,
          }}
        >
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search businesses…"
            aria-label="Search businesses"
            style={{
              width: "100%",
              marginBottom: 8,
              padding: "8px 10px",
              borderRadius: 8,
              border: `1px solid ${cockpitColors.panelBorder}`,
              fontSize: 13,
            }}
          />
          <div style={{ maxHeight: 260, overflowY: "auto", display: "grid", gap: 4 }}>
            {filtered.map((row) => (
              <button
                key={row.id}
                type="button"
                role="option"
                aria-selected={row.id === scope.businessId}
                onClick={() => {
                  setOpen(false);
                  router.push(`/b/${row.id}/home`);
                }}
                style={{
                  textAlign: "left",
                  border: "none",
                  background: row.id === scope.businessId ? "rgba(15,118,110,.08)" : "transparent",
                  borderRadius: 8,
                  padding: "8px 10px",
                  cursor: "pointer",
                  fontWeight: row.id === scope.businessId ? 700 : 500,
                }}
              >
                {row.name}
                {row.role ? (
                  <div style={{ fontSize: 11, color: cockpitColors.textMuted }}>{row.role}</div>
                ) : null}
              </button>
            ))}
            {filtered.length === 0 ? (
              <div style={{ padding: 10, color: cockpitColors.textMuted, fontSize: 13 }}>No matches</div>
            ) : null}
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
            <Link href="/businesses" style={linkStyle} onClick={() => setOpen(false)}>All businesses</Link>
            {isAdmin ? <Link href="/admin" style={linkStyle} onClick={() => setOpen(false)}>Admin</Link> : null}
            <Link href="/architect" style={linkStyle} onClick={() => setOpen(false)}>Architect</Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}

const linkStyle = {
  fontSize: 12,
  color: cockpitColors.accent,
  textDecoration: "none",
  fontWeight: 650,
} as const;
