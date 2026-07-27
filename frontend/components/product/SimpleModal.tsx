"use client";

import type { ReactNode } from "react";
import { X } from "lucide-react";

import { cockpitColors, spacing, typography, radius } from "@/design/tokens";

export default function SimpleModal({
  title,
  children,
  onClose,
  footer,
  maxWidth = 440,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  footer?: ReactNode;
  maxWidth?: number;
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
          maxWidth,
          maxHeight: "min(90vh, 720px)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          borderRadius: radius.large,
          backgroundColor: cockpitColors.panel,
          border: `1px solid ${cockpitColors.panelBorder}`,
          boxShadow: "0 20px 50px rgba(0,0,0,0.15)",
          fontFamily:
            'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          color: cockpitColors.textPrimary,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            flex: "0 0 auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "18px 20px",
            borderBottom: `1px solid ${cockpitColors.panelBorder}`,
          }}
        >
          <h2 style={{ ...typography.sectionTitle, margin: 0, fontSize: "1.1rem" }}>{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              border: "none",
              background: "transparent",
              cursor: "pointer",
              color: cockpitColors.textMuted,
              padding: 4,
              lineHeight: 0,
            }}
          >
            <X size={18} />
          </button>
        </div>
        <div style={{ flex: "1 1 auto", minHeight: 0, overflowY: "auto", padding: "18px 20px" }}>
          {children}
        </div>
        {footer ? (
          <div
            style={{
              flex: "0 0 auto",
              padding: "14px 20px",
              borderTop: `1px solid ${cockpitColors.panelBorder}`,
              display: "flex",
              justifyContent: "flex-end",
              gap: spacing.sm,
              background: cockpitColors.panel,
            }}
          >
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}
