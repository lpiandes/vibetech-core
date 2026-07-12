"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { ChevronDown, LogOut, User } from "lucide-react";
import { useBusinessScope } from "@/lib/platform/BusinessScopeContext";
import { cockpitColors, spacing, radius, typography } from "@/design/tokens";

export default function AccountMenu({ variant = "light" }: { variant?: "light" | "dark" }) {
  const scope = useBusinessScope();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  const dark = variant === "dark";
  const settingsHref = `/b/${encodeURIComponent(scope.businessId)}/settings`;

  useEffect(() => {
    function onDoc(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          height: 34,
          padding: `0 ${spacing.sm}`,
          borderRadius: radius.medium,
          border: `1px solid ${dark ? cockpitColors.sidebarBorder : cockpitColors.panelBorder}`,
          background: "transparent",
          color: dark ? cockpitColors.sidebarText : cockpitColors.textPrimary,
          cursor: "pointer",
          fontSize: typography.caption.fontSize,
          fontWeight: 600,
        }}
      >
        <User size={14} aria-hidden />
        Account
        <ChevronDown size={12} aria-hidden />
      </button>
      {open ? (
        <div
          role="menu"
          style={{
            position: "absolute",
            bottom: "100%",
            left: 0,
            marginBottom: 4,
            minWidth: 180,
            borderRadius: radius.medium,
            border: `1px solid ${cockpitColors.panelBorder}`,
            backgroundColor: cockpitColors.panel,
            boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
            zIndex: 40,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: `${spacing.sm} ${spacing.md}`,
              fontSize: typography.meta.fontSize,
              color: cockpitColors.textMuted,
            }}
          >
            {scope.role}
          </div>
          <Link role="menuitem" href={settingsHref} onClick={() => setOpen(false)} style={menuItemStyle}>
            Settings
          </Link>
          <Link role="menuitem" href="/" onClick={() => setOpen(false)} style={menuItemStyle}>
            Switch business
          </Link>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              void signOut({ callbackUrl: "/login" });
            }}
            style={{
              ...menuItemStyle,
              width: "100%",
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: "transparent",
              border: "none",
              borderTop: `1px solid ${cockpitColors.panelBorder}`,
              cursor: "pointer",
              textAlign: "left",
            }}
          >
            <LogOut size={14} aria-hidden />
            Sign out
          </button>
        </div>
      ) : null}
    </div>
  );
}

const menuItemStyle: CSSProperties = {
  display: "block",
  padding: `${spacing.sm} ${spacing.md}`,
  color: cockpitColors.textPrimary,
  textDecoration: "none",
  fontSize: typography.caption.fontSize,
  borderTop: `1px solid ${cockpitColors.panelBorder}`,
};
