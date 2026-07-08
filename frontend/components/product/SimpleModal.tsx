"use client";

import type { ReactNode } from "react";
import { X } from "lucide-react";

import { cockpitColors, spacing, typography, radius } from "@/design/tokens";
import SecondaryButton from "./SecondaryButton";

export default function SimpleModal({
  title,
  children,
  onClose,
  footer,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  footer?: ReactNode;
}) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: spacing.lg,
        backgroundColor: "rgba(15,23,42,0.45)",
      }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        style={{
          width: "100%",
          maxWidth: 440,
          borderRadius: radius.large,
          backgroundColor: cockpitColors.panel,
          border: `1px solid ${cockpitColors.panelBorder}`,
          boxShadow: "0 20px 50px rgba(0,0,0,0.15)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: spacing.lg, borderBottom: `1px solid ${cockpitColors.panelBorder}` }}>
          <h2 style={{ ...typography.sectionTitle, margin: 0, fontSize: "1.1rem" }}>{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" style={{ border: "none", background: "transparent", cursor: "pointer", color: cockpitColors.textMuted }}>
            <X size={18} />
          </button>
        </div>
        <div style={{ padding: spacing.lg }}>{children}</div>
        {footer ? (
          <div style={{ padding: spacing.lg, borderTop: `1px solid ${cockpitColors.panelBorder}`, display: "flex", justifyContent: "flex-end", gap: spacing.sm }}>
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}
