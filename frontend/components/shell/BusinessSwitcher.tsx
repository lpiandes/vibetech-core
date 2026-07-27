"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { useBusinessScope } from "@/lib/platform/BusinessScopeContext";
import { cockpitColors, spacing, radius, typography } from "@/design/tokens";

type BusinessOption = { id: string; name: string; source?: "membership" | "admin" };

/**
 * Business switcher — memberships for everyone; platform admins also see the full directory.
 */
export default function BusinessSwitcher() {
  const scope = useBusinessScope();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<BusinessOption[]>([]);
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/me/businesses");
        if (!res.ok) return;
        const data = await res.json();
        const memberships = Array.isArray(data.businesses) ? data.businesses : [];
        const adminDirectory = Array.isArray(data.adminDirectory) ? data.adminDirectory : [];
        const byId = new Map<string, BusinessOption>();
        for (const b of memberships) {
          const id = String(b.id ?? b.businessId ?? "");
          if (!id) continue;
          byId.set(id, {
            id,
            name: String(b.name ?? b.businessName ?? "Business"),
            source: "membership",
          });
        }
        if (data.isPlatformAdmin) {
          for (const b of adminDirectory) {
            const id = String(b.id ?? "");
            if (!id || byId.has(id)) continue;
            byId.set(id, {
              id,
              name: String(b.name ?? "Business"),
              source: "admin",
            });
          }
        }
        if (!cancelled) {
          setIsPlatformAdmin(Boolean(data.isPlatformAdmin));
          setOptions([...byId.values()].sort((a, b) => a.name.localeCompare(b.name)));
        }
      } catch {
        /* optional */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((b) => b.name.toLowerCase().includes(q) || b.id.toLowerCase().includes(q));
  }, [options, query]);

  return (
    <div style={{ position: "relative" }}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          maxWidth: 220,
          border: "none",
          background: "transparent",
          cursor: "pointer",
          padding: 0,
          fontWeight: 600,
          fontSize: typography.sectionTitle.fontSize,
          color: cockpitColors.textPrimary,
        }}
      >
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {scope.businessName || "Workspace"}
        </span>
        <ChevronDown size={14} aria-hidden />
      </button>
      {open ? (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            marginTop: 4,
            minWidth: 280,
            maxHeight: 360,
            overflow: "auto",
            borderRadius: radius.medium,
            border: `1px solid ${cockpitColors.panelBorder}`,
            backgroundColor: cockpitColors.panel,
            boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
            zIndex: 30,
          }}
        >
          {(isPlatformAdmin || options.length > 6) ? (
            <div style={{ padding: spacing.sm }}>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={isPlatformAdmin ? "Search all businesses…" : "Search businesses…"}
                aria-label="Search businesses"
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  borderRadius: 10,
                  border: `1px solid ${cockpitColors.panelBorder}`,
                  padding: "8px 10px",
                  fontSize: 13,
                }}
              />
            </div>
          ) : null}
          <ul
            role="listbox"
            aria-label="Switch business"
            style={{
              listStyle: "none",
              padding: 0,
              margin: 0,
            }}
          >
            {filtered.length === 0 ? (
              <li style={{ padding: spacing.md, color: cockpitColors.textMuted, fontSize: typography.meta.fontSize }}>
                <Link href="/businesses" style={{ color: cockpitColors.accent }} onClick={() => setOpen(false)}>
                  All businesses
                </Link>
              </li>
            ) : (
              filtered.map((b) => (
                <li key={b.id} role="option" aria-selected={b.id === scope.businessId}>
                  <Link
                    href={
                      isPlatformAdmin && b.source === "admin"
                        ? `/admin/businesses/${encodeURIComponent(b.id)}`
                        : `/b/${encodeURIComponent(b.id)}/home`
                    }
                    onClick={() => setOpen(false)}
                    style={{
                      display: "block",
                      padding: `${spacing.sm} ${spacing.md}`,
                      textDecoration: "none",
                      color: cockpitColors.textPrimary,
                      fontWeight: b.id === scope.businessId ? 700 : 500,
                      fontSize: typography.caption.fontSize,
                      background: b.id === scope.businessId ? cockpitColors.accentMuted : "transparent",
                    }}
                  >
                    {b.name}
                    {b.source === "admin" ? (
                      <span style={{ marginLeft: 8, color: cockpitColors.textMuted, fontSize: 11 }}>Admin</span>
                    ) : null}
                  </Link>
                </li>
              ))
            )}
          </ul>
          <div style={{ borderTop: `1px solid ${cockpitColors.panelBorder}`, padding: spacing.sm }}>
            <Link
              href={isPlatformAdmin ? "/admin/businesses" : "/businesses"}
              onClick={() => setOpen(false)}
              style={{ color: cockpitColors.accent, fontSize: 12, fontWeight: 650, textDecoration: "none" }}
            >
              {isPlatformAdmin ? "Manage all businesses" : "All businesses"}
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
