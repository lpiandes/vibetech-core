"use client";

import { useSetupViewModel } from "./SetupContext";
import { ProductPage, PageHeader, Section } from "@/components/product";
import { cockpitColors, spacing, typography } from "@/design/tokens";

function safeArray(v: unknown) {
  return Array.isArray(v) ? v : [];
}

export default function SetupExecutiveLayout() {
  const vm = useSetupViewModel();
  const identity = vm?.productContext?.identity ?? {};

  return (
    <ProductPage>
      <PageHeader title="Settings" description={String(identity.businessName ?? "Your business")} />

      {safeArray(vm?.sections).map((section: any) => (
        <Section key={String(section.id)} title={String(section.title)}>
          {safeArray(section.items).map((item: any, idx: number) => (
            <div
              key={`${section.id}_${idx}`}
              style={{
                padding: `${spacing.sm} ${spacing.lg}`,
                borderBottom: idx < safeArray(section.items).length - 1 ? `1px solid ${cockpitColors.panelBorder}` : undefined,
                display: "flex",
                justifyContent: "space-between",
                gap: spacing.md,
              }}
            >
              <span style={{ fontSize: typography.caption.fontSize, color: cockpitColors.textSecondary }}>{String(item.label)}</span>
              <span style={{ fontWeight: 600, fontSize: typography.body.fontSize, color: cockpitColors.textPrimary, textAlign: "right" }}>
                {String(item.value)}
              </span>
            </div>
          ))}
        </Section>
      ))}
    </ProductPage>
  );
}
