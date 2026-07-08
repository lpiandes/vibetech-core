import { semanticColors, spacing, typography } from "@/design/tokens";
import ExecutiveSurface from "@/components/executive/ExecutiveSurface";
import ExecutiveStack from "@/components/executive/ExecutiveStack";
import ExecutiveHeader from "@/components/executive/ExecutiveHeader";
import ExecutiveCard from "@/components/executive/ExecutiveCard";
import ExecutiveDivider from "@/components/executive/ExecutiveDivider";
import MetricCard from "@/components/executive/MetricCard";

import ColorSection from "./ColorSection";
import TypographySection from "./TypographySection";
import SpacingSection from "./SpacingSection";
import HealthSection from "./HealthSection";
import StatusSection from "./StatusSection";
import ExecutiveComponentSection from "./ExecutiveComponentSection";
import LoadingStateSection from "./LoadingStateSection";
import EmptyStateSection from "./EmptyStateSection";

const DESIGN_LANGUAGE = "VIBETech Executive Design Language";
const CURRENT_THEME = "Light";
const TOKEN_VERSION = "v1 (semantic foundations)";

export default function DesignSystemRenderer() {
  return (
    <ExecutiveSurface>
      <div style={{ width: "100%", padding: spacing.xl }}>
        <ExecutiveStack gap="xl">
          <ExecutiveCard style={{ padding: spacing.lg }}>
            <ExecutiveHeader title="Design System Playground" subtitle="Internal preview: executive primitives + semantic tokens." />

            <div style={{ marginTop: spacing.md, display: "grid", gap: spacing.sm, gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
              <MetricCard title="Current Design Language" value={DESIGN_LANGUAGE} status="internal" priority="Later" />
              <MetricCard title="Current Theme" value={CURRENT_THEME} status="internal" priority="Later" />
              <MetricCard title="Current Token Version" value={TOKEN_VERSION} status="internal" priority="Later" />
            </div>
          </ExecutiveCard>

          <ExecutiveDivider />

          <ExecutiveCard style={{ padding: spacing.lg }}>
            <div style={{ color: semanticColors.textSecondary, fontSize: typography.body.fontSize, lineHeight: typography.body.lineHeight, fontWeight: typography.body.fontWeight }}>
              Design Philosophy
            </div>
            <div style={{ marginTop: spacing.xs, color: semanticColors.textPrimary, fontSize: typography.sectionTitle.fontSize, lineHeight: typography.sectionTitle.lineHeight, fontWeight: typography.sectionTitle.fontWeight }}>
              Calm, decision-first, deterministic UI.
            </div>
            <div style={{ marginTop: spacing.sm, color: semanticColors.textSecondary, fontSize: typography.body.fontSize, lineHeight: typography.body.lineHeight, fontWeight: typography.body.fontWeight }}>
              This page is never customer-facing. It previews the executive component library with realistic sample props and deterministic mock data.
            </div>
          </ExecutiveCard>

          <ColorSection />
          <TypographySection />
          <SpacingSection />
          <HealthSection />
          <StatusSection />
          <ExecutiveComponentSection />

          <LoadingStateSection />
          <EmptyStateSection />
        </ExecutiveStack>
      </div>
    </ExecutiveSurface>
  );
}
