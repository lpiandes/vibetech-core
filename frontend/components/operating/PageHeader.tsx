"use client";

import type { ReactNode } from "react";
import { cockpitColors, spacing } from "@/design/tokens";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  void description;
  return (
    <header
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        justifyContent: "space-between",
        gap: spacing.md,
        marginBottom: spacing.md,
      }}
    >
      <div style={{ display: "grid", gap: 4, maxWidth: 720 }}>
        {eyebrow ? (
          <div
            style={{
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: cockpitColors.accent,
            }}
          >
            {eyebrow}
          </div>
        ) : null}
        <h1
          style={{
            margin: 0,
            fontSize: "1.75rem",
            fontWeight: 800,
            letterSpacing: "-0.03em",
            lineHeight: 1.15,
            color: cockpitColors.textPrimary,
          }}
        >
          {title}
        </h1>
      </div>
      {actions ? <div style={{ display: "flex", gap: spacing.sm, flexWrap: "wrap" }}>{actions}</div> : null}
    </header>
  );
}

export function SectionHeader({
  title,
  description,
  action,
  id,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  id?: string;
}) {
  void description;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "baseline",
        justifyContent: "space-between",
        gap: spacing.md,
        marginBottom: spacing.md,
      }}
    >
      <div>
        <h2
          id={id}
          style={{
            margin: 0,
            fontSize: "1.05rem",
            fontWeight: 800,
            letterSpacing: "-0.02em",
            color: cockpitColors.textPrimary,
          }}
        >
          {title}
        </h2>
      </div>
      {action ?? null}
    </div>
  );
}
