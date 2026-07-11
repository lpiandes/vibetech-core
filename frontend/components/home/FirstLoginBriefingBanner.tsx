"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { cockpitColors, spacing, typography, radius } from "@/design/tokens";

/**
 * Dismissible first-login executive briefing after Architect install.
 * Uses existing home readiness signals — no new backend.
 */
export default function FirstLoginBriefingBanner({
  businessId,
  businessName,
  show,
}: {
  businessId: string;
  businessName: string;
  show: boolean;
}) {
  const storageKey = `vt_exec_briefing_dismissed_${businessId}`;
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!show) {
      setVisible(false);
      return;
    }
    try {
      setVisible(window.localStorage.getItem(storageKey) !== "1");
    } catch {
      setVisible(true);
    }
  }, [show, storageKey]);

  if (!visible) return null;

  function dismiss() {
    try {
      window.localStorage.setItem(storageKey, "1");
    } catch {
      /* ignore */
    }
    setVisible(false);
  }

  return (
    <div
      style={{
        marginBottom: spacing.md,
        padding: spacing.md,
        borderRadius: radius.large,
        border: `1px solid ${cockpitColors.panelBorder}`,
        background: `linear-gradient(135deg, ${cockpitColors.panel} 0%, ${cockpitColors.panelElevated ?? cockpitColors.panel} 100%)`,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: spacing.md, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div style={{ minWidth: 0, maxWidth: 640 }}>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: cockpitColors.accent }}>
            Your business is running
          </div>
          <div style={{ marginTop: 6, fontWeight: 650, fontSize: typography.body.fontSize, color: cockpitColors.textPrimary }}>
            Welcome to {businessName}
          </div>
          <div style={{ marginTop: 4, fontSize: typography.caption.fontSize, color: cockpitColors.textSecondary, lineHeight: 1.5 }}>
            Architect installed your operating system. Walk the home screen, invite your team, and keep refining with Ask VIBETech.
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: spacing.sm }}>
            <Link
              href={`/b/${businessId}/settings`}
              style={{
                color: cockpitColors.accent,
                fontWeight: 650,
                fontSize: typography.caption.fontSize,
                textDecoration: "none",
              }}
            >
              Invite your team
            </Link>
            <button
              type="button"
              onClick={dismiss}
              style={{
                border: "none",
                background: "transparent",
                color: cockpitColors.textSecondary,
                cursor: "pointer",
                fontSize: typography.caption.fontSize,
                padding: 0,
              }}
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
