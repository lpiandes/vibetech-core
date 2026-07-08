"use client";

import { useState, useEffect, useRef } from "react";
import { Bell, Search } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { useBusinessScope } from "@/lib/platform/BusinessScopeContext";
import { cockpitColors, spacing, typography, radius } from "@/design/tokens";
import StatusPill from "@/components/executive/StatusPill";

type SearchResult = { id: string; label: string; sublabel?: string; href: string };

export default function Topbar() {
  const scope = useBusinessScope();
  const businessName = scope.businessName || "Workspace";

  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) {
      setResults([]);
      setOpen(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/workspace/search?q=${encodeURIComponent(query.trim())}`);
        const data = await res.json();
        setResults(Array.isArray(data.results) ? data.results : []);
        setOpen(true);
      } catch {
        setResults([]);
      }
    }, 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        borderBottom: `1px solid ${cockpitColors.panelBorder}`,
        backgroundColor: cockpitColors.panel,
        padding: `${spacing.sm} ${spacing.lg}`,
        gap: spacing.lg,
        position: "sticky",
        top: 0,
        zIndex: 20,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: spacing.sm }}>
        <Link href="/" style={{ textDecoration: "none", color: cockpitColors.textMuted, fontSize: 12 }}>
          Businesses
        </Link>
        <span style={{ color: cockpitColors.textMuted }}>/</span>
        <div style={{ fontWeight: 600, fontSize: typography.sectionTitle.fontSize, color: cockpitColors.textPrimary }}>
          {businessName}
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: spacing.md, flex: 1, justifyContent: "flex-end" }}>
        <div style={{ position: "relative", maxWidth: 300, width: "100%" }}>
          <Search
            style={{
              position: "absolute",
              left: spacing.sm,
              top: "50%",
              transform: "translateY(-50%)",
              width: 14,
              height: 14,
              color: cockpitColors.textMuted,
              pointerEvents: "none",
            }}
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => query.trim() && setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            placeholder="Search people, units, work…"
            aria-label="Search workspace"
            style={{
              width: "100%",
              height: 34,
              borderRadius: radius.medium,
              border: `1px solid ${cockpitColors.panelBorder}`,
              backgroundColor: cockpitColors.panelElevated,
              paddingLeft: 30,
              paddingRight: spacing.sm,
              fontSize: typography.caption.fontSize,
              outline: "none",
            }}
          />
          {open && results.length > 0 ? (
            <div
              style={{
                position: "absolute",
                top: "100%",
                left: 0,
                right: 0,
                marginTop: 4,
                borderRadius: radius.medium,
                border: `1px solid ${cockpitColors.panelBorder}`,
                backgroundColor: cockpitColors.panel,
                boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
                zIndex: 30,
                maxHeight: 240,
                overflow: "auto",
              }}
            >
              {results.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    setQuery("");
                    setOpen(false);
                    router.push(r.href);
                  }}
                  style={{
                    display: "block",
                    width: "100%",
                    textAlign: "left",
                    padding: `${spacing.sm} ${spacing.md}`,
                    border: "none",
                    borderBottom: `1px solid ${cockpitColors.panelBorder}`,
                    background: "transparent",
                    cursor: "pointer",
                  }}
                >
                  <div style={{ fontSize: typography.body.fontSize, fontWeight: 500, color: cockpitColors.textPrimary }}>{r.label}</div>
                  {r.sublabel ? (
                    <div style={{ fontSize: typography.caption.fontSize, color: cockpitColors.textMuted }}>{r.sublabel}</div>
                  ) : null}
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <button
          type="button"
          aria-label="Notifications"
          style={{
            width: 34,
            height: 34,
            borderRadius: radius.medium,
            border: `1px solid ${cockpitColors.panelBorder}`,
            background: "transparent",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: cockpitColors.textMuted,
          }}
        >
          <Bell size={16} />
        </button>
      </div>
    </div>
  );
}
