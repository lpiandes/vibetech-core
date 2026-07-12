"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { useBusinessScope } from "@/lib/platform/BusinessScopeContext";
import { cockpitColors, spacing, radius, typography } from "@/design/tokens";

type BusinessOption = { id: string; name: string };

/**
 * Lightweight business switcher — lists recent businesses from cookie/API when available.
 */
export default function BusinessSwitcher() {
  const scope = useBusinessScope();
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<BusinessOption[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/me/businesses");
        if (!res.ok) return;
        const data = await res.json();
        const list = Array.isArray(data.businesses)
          ? data.businesses
          : Array.isArray(data)
            ? data
            : [];
        if (!cancelled) {
          setOptions(
            list
              .map((b: any) => ({ id: String(b.id ?? b.businessId), name: String(b.name ?? b.businessName ?? "Business") }))
              .filter((b: BusinessOption) => b.id),
          );
        }
      } catch {
        /* optional */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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
        <ul
          role="listbox"
          aria-label="Switch business"
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            marginTop: 4,
            minWidth: 220,
            maxHeight: 280,
            overflow: "auto",
            listStyle: "none",
            padding: 0,
            margin: 0,
            borderRadius: radius.medium,
            border: `1px solid ${cockpitColors.panelBorder}`,
            backgroundColor: cockpitColors.panel,
            boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
            zIndex: 30,
          }}
        >
          {options.length === 0 ? (
            <li style={{ padding: spacing.md, color: cockpitColors.textMuted, fontSize: typography.meta.fontSize }}>
              <Link href="/" style={{ color: cockpitColors.accent }} onClick={() => setOpen(false)}>
                All businesses
              </Link>
            </li>
          ) : (
            options.map((b) => (
              <li key={b.id} role="option" aria-selected={b.id === scope.businessId}>
                <Link
                  href={`/b/${encodeURIComponent(b.id)}/home`}
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
                </Link>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}
