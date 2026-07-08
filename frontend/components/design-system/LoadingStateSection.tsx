import { spacing } from "@/design/tokens";
import ExecutiveHeader from "@/components/executive/ExecutiveHeader";
import ExecutiveCard from "@/components/executive/ExecutiveCard";
import ExecutiveStack from "@/components/executive/ExecutiveStack";
import ExecutiveLoadingCard from "@/components/executive/ExecutiveLoadingCard";

export default function LoadingStateSection() {
  return (
    <div>
      <ExecutiveHeader title="Loading States" subtitle="Stable, calm loading UX (deterministic skeletons)." />
      <div style={{ marginTop: spacing.md }}>
        <ExecutiveCard style={{ padding: spacing.lg }}>
          <ExecutiveStack gap="md">
            <ExecutiveLoadingCard label="Preparing executive summary..." />
            <ExecutiveLoadingCard label="Rendering KPI strip..." />
            <ExecutiveLoadingCard label="Calibrating attention signals..." />
          </ExecutiveStack>
        </ExecutiveCard>
      </div>
    </div>
  );
}
