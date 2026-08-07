"use client";

import { useEffect, useId, useState, type CSSProperties } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, MessageSquare, X } from "lucide-react";

import GlobalAskVibeTechEntry from "@/components/shell/GlobalAskVibeTechEntry";
import PrimaryNavigation from "@/components/shell/PrimaryNavigation";
import AccountMenu from "@/components/shell/AccountMenu";
import { useBusinessScope } from "@/lib/platform/BusinessScopeContext";
import { cockpitColors, spacing, radius, typography } from "@/design/tokens";

/**
 * Mobile drawer + sticky Ask VIBETech entry for the business shell.
 * Visibility uses media queries in CSS (not Tailwind vs inline display conflicts).
 */
export default function MobileNavigationDrawer({
  needsAttentionCount = 0,
}: {
  needsAttentionCount?: number;
}) {
  const [open, setOpen] = useState(false);
  const scope = useBusinessScope();
  const pathname = usePathname() ?? "";
  const onAsk = /\/architect(?:\/|$)/.test(pathname);
  const titleId = useId();
  const architectHref = `/b/${encodeURIComponent(scope.businessId)}/architect`;

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <>
      <style>{`
        .vt-mobile-only { display: none; }
        @media (max-width: 767px) {
          .vt-mobile-only { display: flex; }
          .vt-mobile-fab { display: inline-flex !important; }
        }
        @media (min-width: 768px) {
          .vt-mobile-fab { display: none !important; }
        }
        @media (prefers-reduced-motion: reduce) {
          .vt-mobile-fab { transition: none !important; }
        }
      `}</style>

      <div
        className="vt-mobile-only"
        style={{
          position: "sticky",
          top: 0,
          zIndex: 40,
          alignItems: "center",
          justifyContent: "space-between",
          gap: spacing.sm,
          padding: `${spacing.sm} ${spacing.md}`,
          borderBottom: `1px solid ${cockpitColors.panelBorder}`,
          backgroundColor: cockpitColors.panel,
        }}
      >
        <button
          type="button"
          aria-expanded={open}
          aria-controls="mobile-nav-drawer"
          aria-label="Open navigation"
          onClick={() => setOpen(true)}
          style={iconButtonStyle}
        >
          <Menu size={20} aria-hidden />
        </button>
        <div style={{ fontWeight: 700, fontSize: typography.body.fontSize, color: cockpitColors.textPrimary }}>
          {scope.businessName || "VIBETech"}
        </div>
        <GlobalAskVibeTechEntry compact />
      </div>

      {!onAsk ? (
      <Link
        href={architectHref}
        className="vt-mobile-fab"
        aria-label="Ask VIBETech"
        style={{
          position: "fixed",
          right: 16,
          bottom: 20,
          zIndex: 35,
          display: "none",
          alignItems: "center",
          gap: 8,
          padding: "12px 16px",
          borderRadius: radius.pill,
          backgroundColor: cockpitColors.accent,
          color: "#fff",
          textDecoration: "none",
          fontWeight: 600,
          fontSize: typography.button.fontSize,
          boxShadow: "0 8px 24px rgba(15, 23, 42, 0.2)",
        }}
      >
        <MessageSquare size={16} aria-hidden />
        Ask VIBETech
      </Link>
      ) : null}

      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          id="mobile-nav-drawer"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 50,
            display: "flex",
          }}
        >
          <button
            type="button"
            aria-label="Close navigation"
            onClick={() => setOpen(false)}
            style={{
              flex: 1,
              border: "none",
              background: cockpitColors.overlay,
              cursor: "pointer",
            }}
          />
          <div
            style={{
              width: "min(320px, 88vw)",
              backgroundColor: cockpitColors.sidebar,
              color: cockpitColors.sidebarText,
              display: "flex",
              flexDirection: "column",
              height: "100%",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: spacing.md,
                borderBottom: `1px solid ${cockpitColors.sidebarBorder}`,
              }}
            >
              <div id={titleId} style={{ fontWeight: 700 }}>
                Menu
              </div>
              <button
                type="button"
                aria-label="Close menu"
                onClick={() => setOpen(false)}
                style={{
                  ...iconButtonStyle,
                  color: cockpitColors.sidebarText,
                  borderColor: cockpitColors.sidebarBorder,
                }}
              >
                <X size={18} aria-hidden />
              </button>
            </div>
            <div style={{ flex: 1, minHeight: 0, overflow: "auto" }}>
              <PrimaryNavigation needsAttentionCount={needsAttentionCount} onNavigate={() => setOpen(false)} />
            </div>
            <div style={{ padding: spacing.md, borderTop: `1px solid ${cockpitColors.sidebarBorder}` }}>
              <AccountMenu variant="dark" />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

const iconButtonStyle: CSSProperties = {
  width: 40,
  height: 40,
  borderRadius: radius.medium,
  border: `1px solid ${cockpitColors.panelBorder}`,
  background: "transparent",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  color: cockpitColors.textPrimary,
  textDecoration: "none",
  cursor: "pointer",
};
