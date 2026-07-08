"use client";

import type { ReactNode } from "react";
import { Component } from "react";

import ExecutiveCard from "@/components/executive/ExecutiveCard";
import { semanticColors, spacing, typography } from "@/design/tokens";

export default class CapabilityErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; message: string }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, message: "" };
  }

  static getDerivedStateFromError(err: any) {
    return { hasError: true, message: String(err?.message ?? err ?? "Capabilities failed to render.") };
  }

  render() {
    if (this.state.hasError) {
      return (
        <ExecutiveCard style={{ padding: spacing.lg }}>
          <div style={{ color: semanticColors.textPrimary, fontSize: typography.cardTitle.fontSize, lineHeight: typography.cardTitle.lineHeight, fontWeight: typography.cardTitle.fontWeight }}>
            Capabilities failed to render.
          </div>
          <div style={{ marginTop: spacing.sm, color: semanticColors.textSecondary, fontSize: typography.body.fontSize, lineHeight: typography.body.lineHeight, fontWeight: typography.body.fontWeight }}>
            Something went wrong while rendering capabilities. Please refresh.
          </div>
          {this.state.message ? (
            <div style={{ marginTop: spacing.xs, color: semanticColors.textMuted, fontSize: typography.caption.fontSize, lineHeight: typography.caption.lineHeight, fontWeight: typography.caption.fontWeight }}>
              {this.state.message}
            </div>
          ) : null}
        </ExecutiveCard>
      );
    }

    return this.props.children;
  }
}

