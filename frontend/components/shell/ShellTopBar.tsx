"use client";

import { useState, useEffect, useRef } from "react";
import { ChevronDown, Plus, Search } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { useBusinessScope } from "@/lib/platform/BusinessScopeContext";
import BusinessSwitcher from "@/components/shell/BusinessSwitcher";
import GlobalAskVibeTechEntry from "@/components/shell/GlobalAskVibeTechEntry";
import NeedsAttentionIndicator from "@/components/shell/NeedsAttentionIndicator";
import { cockpitColors, spacing, typography, radius } from "@/design/tokens";

type SearchResult = { id: string; label: string; sublabel?: string; href: string };

export default function ShellTopBar({ attentionCount = 0 }: { attentionCount?: number }) {
  const scope = useBusinessScope();
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

  const newActions = (() => {
    const fromOs = scope.installedBusinessOS?.primaryActions ?? [];
    if (fromOs.length) {
      return fromOs.slice(0, 4).map((action) => ({ label: action.label, href: action.href }));
    }
    const subjects = scope.installedBusinessOS?.subjectTypes ?? [];
    const subjectLabel = subjects.length
      ? `Add ${String(subjects[0]).replace(/_/g, " ")}`
      : "Add contact";
    const subjectHref = subjects.includes("property") ? `${base}/properties?add=1` : `${base}/people`;
    return [
      { label: subjectLabel, href: subjectHref },
      { label: "Add knowledge", href: `${base}/knowledge?add=1` },
      { label: "Invite team", href: `${base}/team` },
    ];
  })();

  const searchPlaceholder = (() => {
    const terminology = scope.installedBusinessOS?.terminology as any;
    const entities = terminology?.entityLabels ?? terminology?.presentation?.entityLabels ?? {};
    const people = entities.people ?? entities.person ?? "people";
    const subjects =
      entities.subject ?? entities.record ?? (scope.installedBusinessOS?.subjectTypes?.[0] ?? "records");
    return `Search ${people}, ${String(subjects).replace(/_/g, " ")}, work…`;
  })();

  const supportAccess = scope.supportAccess;
  const adminView = Boolean(supportAccess?.active);

  async function exitAdminView() {
    try {
      await fetch("/api/admin/support/exit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId: scope.businessId }),
      });
    } catch {
      /* non-blocking */
    }
    router.push(`/admin/businesses/${encodeURIComponent(scope.businessId)}`);
    router.refresh();
  }

  return (
    <>
    {adminView ? (
      <div
        role="status"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: spacing.md,
          padding: `${spacing.sm} ${spacing.lg}`,
          background: "#0891b2",
          color: "#fff",
          fontSize: 13,
          fontWeight: 600,
        }}
      >
        <span>
          Admin view · {supportAccess?.mode === "elevated" ? "full edit" : "read-only"} · {scope.businessName || "Business"}
        </span>
        <button
          type="button"
          onClick={() => void exitAdminView()}
          style={{
            border: "1px solid rgba(255,255,255,0.35)",
            background: "transparent",
            color: "#fff",
            borderRadius: radius.medium,
            padding: "4px 10px",
            cursor: "pointer",
            fontWeight: 650,
            fontSize: 12,
          }}
        >
          Exit to admin
        </button>
      </div>
    ) : null}
    <header
      className="vt-desktop-only"
      style={{
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
        <Link
          href="/businesses"
          style={{ textDecoration: "none", color: cockpitColors.textMuted, fontSize: 12, flexShrink: 0 }}
        >
          Businesses
        </Link>
        <span style={{ color: cockpitColors.textMuted, flexShrink: 0 }} aria-hidden>
          /
        </span>
        <BusinessSwitcher />
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: spacing.md, flex: 1, justifyContent: "flex-end" }}>
        <div style={{ position: "relative", maxWidth: 300, width: "100%" }}>
          <Search
            aria-hidden
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
            placeholder={searchPlaceholder}
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
              role="listbox"
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
                  role="option"
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
                  <div style={{ fontSize: typography.body.fontSize, fontWeight: 500, color: cockpitColors.textPrimary }}>
                    {r.label}
                  </div>
                  {r.sublabel ? (
                    <div style={{ fontSize: typography.caption.fontSize, color: cockpitColors.textMuted }}>
                      {r.sublabel}
                    </div>
                  ) : null}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div ref={newMenuRef} style={{ position: "relative" }}>
          <button
            type="button"
            aria-haspopup="menu"
            aria-expanded={newMenuOpen}
            onClick={() => setNewMenuOpen((prev) => !prev)}
            style={{
              height: 34,
              padding: `0 ${spacing.md}`,
              borderRadius: radius.medium,
              border: `1px solid ${cockpitColors.panelBorder}`,
              backgroundColor: cockpitColors.panelElevated,
              color: cockpitColors.textPrimary,
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: typography.caption.fontSize,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            <Plus size={14} aria-hidden />
            New
            <ChevronDown size={12} aria-hidden />
          </button>
          {newMenuOpen ? (
            <div
              role="menu"
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
                  role="menuitem"
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

        <NeedsAttentionIndicator count={attentionCount} />
        <GlobalAskVibeTechEntry compact />
      </div>
    </header>
    </>
  );
}
