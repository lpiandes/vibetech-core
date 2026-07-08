import { semanticColors, spacing, typography } from "@/design/tokens";
import ExecutiveSurface from "@/components/executive/ExecutiveSurface";
import ExecutiveStack from "@/components/executive/ExecutiveStack";
import ExecutiveHeader from "@/components/executive/ExecutiveHeader";
import ExecutiveCard from "@/components/executive/ExecutiveCard";
import type { ReactNode } from "react";

export default function DesignSystemLayout({
  top,
  children,
}: {
  top: ReactNode;
  children: ReactNode;
}) {
  return (
    <ExecutiveSurface>
      <div style={{ width: "100%", padding: spacing.xl }}>
        <ExecutiveStack gap="xl">
          {top}
          <ExecutiveCard style={{ padding: spacing.lg, backgroundColor: semanticColors.surface }}>
            <ExecutiveHeader title="Design System" subtitle="Internal executive component previews (never customer-facing)." />
          </ExecutiveCard>
          {children}
        </ExecutiveStack>
      </div>
    </ExecutiveSurface>
  );
}
