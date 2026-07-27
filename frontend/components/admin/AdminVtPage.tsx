"use client";

import type { ReactNode } from "react";
import {
  VtDock,
  VtHero,
  VtPage,
  VtStatusChip,
} from "@/components/product/VtChrome";

/**
 * Shared Admin page chrome — same VtHero/VtPage language as client mission tools.
 */
export default function AdminVtPage({
  title,
  eyebrow = "Admin",
  statusLabel,
  statusTone = "neutral",
  dock,
  children,
  maxWidth = 1440,
}: {
  title: ReactNode;
  eyebrow?: string;
  statusLabel?: string;
  statusTone?: "live" | "warn" | "off" | "neutral";
  dock?: ReactNode;
  children: ReactNode;
  maxWidth?: number | "none";
}) {
  return (
    <VtPage maxWidth={maxWidth}>
      <VtHero
        eyebrow={eyebrow}
        title={title}
        right={statusLabel ? <VtStatusChip label={statusLabel} tone={statusTone} /> : undefined}
      >
        {dock ? <VtDock>{dock}</VtDock> : null}
      </VtHero>
      {children}
    </VtPage>
  );
}
