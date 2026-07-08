"use client";

import { useState, useEffect, useRef } from "react";
import { Bell, ChevronDown, Plus, Search } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { useBusinessScope } from "@/lib/platform/BusinessScopeContext";
import { cockpitColors, spacing, typography, radius } from "@/design/tokens";

type SearchResult = { id: string; label: string; sublabel?: string; href: string };

export default function ShellTopBar({ attentionCount = 0 }: { attentionCount?: number }) {
  const scope = useBusinessScope();
  const businessName = scope.businessName || "Workspace";
  const base = `/b/${scope.businessId}`;

  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [newMenuOpen, setNewMenuOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const newMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) {
      setResults([]);
      setOpen(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/workspace/search?q=${encodeURIComponent(query.trim())}&businessId=${encodeURIComponent(scope.businessId)}`,
        );
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
  }, [query, scope.businessId]);

  useEffect(() => {
    function onDocClick(event: MouseEvent) {
      if (newMenuRef.current && !newMenuRef.current.contains(event.target as Node)) {
        setNewMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const newActions = [
    { label: "Add property", href: `${base}/properties?add=1` },
    { label: "Add knowledge", href: `${base}/knowledge?add=1` },
    { label: "Invite team", href: `${base}/team` },
  ];

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
      <div style={{ display: "flex", alignItems: "center", gap: spacing.sm, minWidth: 0 }}>
        <Link href="/" style={{ textDecoration: "none", color: cockpitColors.textMuted, fontSize: 12, flexShrink: 0 }}>
          Businesses
        </Link>
        <span style={{ color: cockpitColors.textMuted, flexShrink: 0 }}>/</span>
        <div
          style={{
            fontWeight: 600,
            fontSize: typography.sectionTitle.fontSize,
            color: cockpitColors.textPrimary,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
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
            placeholder="Search people, properties, work…"
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

        <div ref={newMenuRef} style={{ position: "relative" }}>
          <button
            type="button"
            onClick={() => setNewMenuOpen((prev) => !prev)}
            style={{
              height: 34,
              padding: `0 ${spacing.md}`,
              borderRadius: radius.medium,
              border: `1px solid ${cockpitColors.panelBorder}`,
              backgroundColor: cockpitColors.accent,
              color: "#fff",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: typography.caption.fontSize,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            <Plus size={14} />
            New
            <ChevronDown size={12} />
          </button>
          {newMenuOpen ? (
            <div
              style={{
                position: "absolute",
                top: "100%",
                right: 0,
                marginTop: 4,
                minWidth: 180,
                borderRadius: radius.medium,
                border: `1px solid ${cockpitColors.panelBorder}`,
                backgroundColor: cockpitColors.panel,
                boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
                zIndex: 30,
                overflow: "hidden",
              }}
            >
              {newActions.map((action) => (
                <Link
                  key={action.href}
                  href={action.href}
                  onClick={() => setNewMenuOpen(false)}
                  style={{
                    display: "block",
                    padding: `${spacing.sm} ${spacing.md}`,
                    color: cockpitColors.textPrimary,
                    textDecoration: "none",
                    fontSize: typography.caption.fontSize,
                    borderBottom: `1px solid ${cockpitColors.panelBorder}`,
                  }}
                >
                  {action.label}
                </Link>
              ))}
            </div>
          ) : null}
        </div>

        <Link
          href={`${base}/for-you`}
          aria-label="Notifications"
          style={{
            position: "relative",
            width: 34,
            height: 34,
            borderRadius: radius.medium,
            border: `1px solid ${cockpitColors.panelBorder}`,
            background: "transparent",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: cockpitColors.textMuted,
            textDecoration: "none",
          }}
        >
          <Bell size={16} />
          {attentionCount > 0 ? (
            <span
              style={{
                position: "absolute",
                top: -4,
                right: -4,
                minWidth: 16,
                height: 16,
                borderRadius: 999,
                backgroundColor: cockpitColors.warning,
                color: "#fff",
                fontSize: 10,
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "0 4px",
              }}
            >
              {attentionCount > 9 ? "9+" : attentionCount}
            </span>
          ) : null}
        </Link>
      </div>
    </div>
  );
}
