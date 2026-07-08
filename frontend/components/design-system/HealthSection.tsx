import { spacing, semanticColors, typography } from "@/design/tokens";
import ExecutiveHeader from "@/components/executive/ExecutiveHeader";
import ExecutiveCard from "@/components/executive/ExecutiveCard";
import ExecutiveStack from "@/components/executive/ExecutiveStack";
import HealthBadge, { type HealthLevel } from "@/components/executive/HealthBadge";

export default function HealthSection() {
  const levels: HealthLevel[] = ["excellent", "good", "warning", "critical"];

  return (
    <div>
      <ExecutiveHeader title="Health" subtitle="Excellent, good, warning, critical." />
      <div style={{ marginTop: spacing.md }}>
        <ExecutiveCard style={{ padding: spacing.lg }}>
          <ExecutiveStack gap="md">
            <div style={{ display: "flex", flexWrap: "wrap", gap: spacing.sm }}>
              {levels.map((lvl) => (
                <HealthBadge key={lvl} level={lvl} />
              ))}
            </div>
            <div style={{ color: semanticColors.textSecondary, fontSize: typography.caption.fontSize, lineHeight: typography.caption.lineHeight, fontWeight: typography.caption.fontWeight }}>
              Health badges use deterministic semantics and map to the same executive language across Operating Systems.
            </div>
          </ExecutiveStack>
        </ExecutiveCard>
      </div>
    </div>
  );
}
