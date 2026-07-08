import { spacing, typography, semanticColors } from "@/design/tokens";
import ExecutiveHeader from "@/components/executive/ExecutiveHeader";
import ExecutiveCard from "@/components/executive/ExecutiveCard";
import ExecutiveStack from "@/components/executive/ExecutiveStack";

function renderTypographyBlock(label: string, style: { fontSize: string; lineHeight: string; fontWeight: number | string }) {
  return (
    <div
      key={label}
      style={{
        border: `1px solid ${semanticColors.border}`,
        borderRadius: spacing.md,
        padding: spacing.lg,
        backgroundColor: semanticColors.surface,
      }}
    >
      <div style={{ color: semanticColors.textSecondary, fontSize: typography.caption.fontSize, lineHeight: typography.caption.lineHeight, fontWeight: typography.caption.fontWeight }}>
        {label}
      </div>
      <div
        style={{
          marginTop: spacing.sm,
          color: semanticColors.textPrimary,
          fontSize: style.fontSize,
          lineHeight: style.lineHeight,
          fontWeight: style.fontWeight,
        }}
      >
        Executive typography example
      </div>
    </div>
  );
}

export default function TypographySection() {
  const blocks: Array<{ label: string; style: any }> = [
    { label: "display", style: typography.display },
    { label: "pageTitle", style: typography.pageTitle },
    { label: "sectionTitle", style: typography.sectionTitle },
    { label: "cardTitle", style: typography.cardTitle },
    { label: "body", style: typography.body },
    { label: "caption", style: typography.caption },
    { label: "metric", style: typography.metric },
    { label: "label", style: typography.label },
    { label: "button", style: typography.button },
  ];

  return (
    <div>
      <ExecutiveHeader title="Typography" subtitle="Every typography token previewed." />
      <div style={{ marginTop: spacing.md }}>
        <ExecutiveCard style={{ padding: spacing.lg }}>
          <ExecutiveStack gap="md">
            <div style={{ display: "grid", gap: spacing.md, gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
              {blocks.map((b) => renderTypographyBlock(b.label, b.style))}
            </div>
          </ExecutiveStack>
        </ExecutiveCard>
      </div>
    </div>
  );
}
