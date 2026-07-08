import { spacing, semanticColors, typography } from "@/design/tokens";
import ExecutiveHeader from "@/components/executive/ExecutiveHeader";
import ExecutiveCard from "@/components/executive/ExecutiveCard";
import ExecutiveStack from "@/components/executive/ExecutiveStack";
import ExecutiveEmptyState from "@/components/executive/ExecutiveEmptyState";

export default function EmptyStateSection() {
  return (
    <div>
      <ExecutiveHeader title="Empty States" subtitle="Confidence-first empty language (never “No Data”)." />
      <div style={{ marginTop: spacing.md }}>
        <ExecutiveCard style={{ padding: spacing.lg }}>
          <ExecutiveStack gap="md">
            <ExecutiveEmptyState title="Insights" message="No analytics insights require attention." />
            <ExecutiveEmptyState title="Recommendations" message="No recommendations are currently pending." />
            <ExecutiveEmptyState title="Timeline" message="Performance data will appear as the business operates." />
          </ExecutiveStack>
          <div style={{ marginTop: spacing.sm, color: semanticColors.textSecondary, fontSize: typography.caption.fontSize, lineHeight: typography.caption.lineHeight, fontWeight: typography.caption.fontWeight }}>
            Empty states communicate calm expectations and stable positioning.
          </div>
        </ExecutiveCard>
      </div>
    </div>
  );
}
