import { spacing, semanticColors, typography } from "@/design/tokens";
import ExecutiveHeader from "@/components/executive/ExecutiveHeader";
import ExecutiveCard from "@/components/executive/ExecutiveCard";
import ExecutiveStack from "@/components/executive/ExecutiveStack";
import StatusPill from "@/components/executive/StatusPill";

export default function StatusSection() {
  const statuses: Array<{ tone: Parameters<typeof StatusPill>[0]["tone"]; label: string }> = [
    { tone: "success", label: "Success" },
    { tone: "warning", label: "Warning" },
    { tone: "danger", label: "Danger" },
    { tone: "info", label: "Info" },
    { tone: "accent", label: "Accent" },
    { tone: "neutral", label: "Neutral" },
  ];

  return (
    <div>
      <ExecutiveHeader title="Status Pills" subtitle="Every status tone previewed." />
      <div style={{ marginTop: spacing.md }}>
        <ExecutiveCard style={{ padding: spacing.lg }}>
          <ExecutiveStack gap="md">
            <div style={{ display: "flex", flexWrap: "wrap", gap: spacing.sm }}>
              {statuses.map((s) => (
                <StatusPill key={s.tone} tone={s.tone} label={s.label} />
              ))}
            </div>
            <div style={{ color: semanticColors.textSecondary, fontSize: typography.caption.fontSize, lineHeight: typography.caption.lineHeight, fontWeight: typography.caption.fontWeight }}>
              Status pills communicate state and priority through semantic tones only.
            </div>
          </ExecutiveStack>
        </ExecutiveCard>
      </div>
    </div>
  );
}
