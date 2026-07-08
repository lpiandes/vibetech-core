"use client";

import { useState } from "react";
import Link from "next/link";

import ExecutiveCard from "@/components/executive/ExecutiveCard";
import ExecutiveHeader from "@/components/executive/ExecutiveHeader";
import ExecutiveStack from "@/components/executive/ExecutiveStack";
import { semanticColors, spacing, typography } from "@/design/tokens";

export type DemoStoryStep = {
  id: string;
  title: string;
  detail: string;
  href?: string | null;
};

export default function DemoStoryMode({
  enabled = true,
  steps = [],
}: {
  enabled?: boolean;
  steps?: DemoStoryStep[];
}) {
  const [open, setOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  if (!enabled || steps.length === 0) return null;

  const step = steps[stepIndex];

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          position: "fixed",
          bottom: spacing.lg,
          right: spacing.lg,
          zIndex: 50,
          padding: `${spacing.sm} ${spacing.md}`,
          borderRadius: 999,
          border: `1px solid ${semanticColors.border}`,
          backgroundColor: semanticColors.surfaceElevated,
          color: semanticColors.textPrimary,
          cursor: "pointer",
          boxShadow: "0 4px 24px rgba(0,0,0,0.12)",
          fontSize: typography.caption.fontSize,
        }}
      >
        Guided demo
      </button>

      {open ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 60,
            backgroundColor: "rgba(0,0,0,0.4)",
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
            padding: spacing.lg,
          }}
          onClick={() => setOpen(false)}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 520 }}>
            <ExecutiveCard>
              <ExecutiveStack gap="md">
                <ExecutiveHeader title="Operating loop demo" subtitle={`Step ${stepIndex + 1} of ${steps.length}`} />
                <div>
                  <div style={{ fontWeight: 600, fontSize: typography.sectionTitle.fontSize }}>{step.title}</div>
                  <div style={{ marginTop: spacing.sm, color: semanticColors.textSecondary, lineHeight: 1.5 }}>{step.detail}</div>
                  {step.href ? (
                    <div style={{ marginTop: spacing.sm }}>
                      <Link href={step.href} style={{ color: semanticColors.accent, fontSize: typography.caption.fontSize }}>
                        View in product →
                      </Link>
                    </div>
                  ) : null}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", gap: spacing.sm }}>
                  <button
                    type="button"
                    disabled={stepIndex === 0}
                    onClick={() => setStepIndex((i) => Math.max(0, i - 1))}
                    style={{ padding: spacing.sm, cursor: "pointer" }}
                  >
                    Back
                  </button>
                  <button type="button" onClick={() => setOpen(false)} style={{ padding: spacing.sm, cursor: "pointer" }}>
                    Close
                  </button>
                  <button
                    type="button"
                    disabled={stepIndex >= steps.length - 1}
                    onClick={() => setStepIndex((i) => Math.min(steps.length - 1, i + 1))}
                    style={{ padding: spacing.sm, cursor: "pointer" }}
                  >
                    Next
                  </button>
                </div>
              </ExecutiveStack>
            </ExecutiveCard>
          </div>
        </div>
      ) : null}
    </>
  );
}
