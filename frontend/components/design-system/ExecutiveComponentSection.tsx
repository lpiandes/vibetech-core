import { spacing } from "@/design/tokens";
import ExecutiveHeader from "@/components/executive/ExecutiveHeader";
import ExecutiveStack from "@/components/executive/ExecutiveStack";
import ExecutiveGrid from "@/components/executive/ExecutiveGrid";
import ExecutiveCard from "@/components/executive/ExecutiveCard";
import ExecutiveSurface from "@/components/executive/ExecutiveSurface";
import ExecutiveDivider from "@/components/executive/ExecutiveDivider";
import ExecutiveIcon from "@/components/executive/ExecutiveIcon";
import StatusPill from "@/components/executive/StatusPill";
import HealthBadge from "@/components/executive/HealthBadge";
import MetricCard from "@/components/executive/MetricCard";
import BusinessHealthCard from "@/components/executive/BusinessHealthCard";
import RecommendationCard from "@/components/executive/RecommendationCard";
import InsightCard from "@/components/executive/InsightCard";
import ExecutiveEmptyState from "@/components/executive/ExecutiveEmptyState";
import ExecutiveLoadingCard from "@/components/executive/ExecutiveLoadingCard";

import { Sparkles } from "lucide-react";

export default function ExecutiveComponentSection() {
  return (
    <div>
      <ExecutiveHeader title="Executive Component Library" subtitle="Deterministic previews using mock props." />
      <div style={{ marginTop: spacing.md }}>
        <ExecutiveCard style={{ padding: spacing.lg }}>
          <ExecutiveStack gap="md">
            <ExecutiveDivider />
            <ExecutiveGrid columns={3}>
              <ExecutiveSurface>
                <div style={{ padding: spacing.md }}>
                  <div style={{ color: "inherit", fontSize: "0.875rem" }}>ExecutiveSurface</div>
                </div>
              </ExecutiveSurface>
              <ExecutiveHeader title="ExecutiveHeader" subtitle="Preview in context" />
              <StatusPill tone="success" label="Success tone" />
              <StatusPill tone="warning" label="Warning tone" />
              <StatusPill tone="danger" label="Danger tone" />
              <StatusPill tone="info" label="Info tone" />
              <StatusPill tone="accent" label="Accent tone" />
              <StatusPill tone="neutral" label="Neutral tone" />
            </ExecutiveGrid>

            <ExecutiveDivider />

            <ExecutiveGrid columns={2}>
              <HealthBadge level="excellent" />
              <HealthBadge level="good" />
              <HealthBadge level="warning" />
              <HealthBadge level="critical" />
            </ExecutiveGrid>

            <ExecutiveDivider />

            <ExecutiveGrid columns={2}>
              <MetricCard title="Metric Card" value={123} status="recorded" priority="Later" badge="Metric badge" />
              <BusinessHealthCard title="Business Health" score={72} level="good" summary="Operating calmly with measurable utilization." />
              <RecommendationCard title="Recommendation" actionType="review_work_queue" priority={70} recommendation="Rebalance pending work so coverage stays unblocked." />
              <InsightCard title="Insight" category="communications" importance="medium" message="A small fraction of signals needs review to keep approvals flowing." />
            </ExecutiveGrid>

            <ExecutiveDivider />

            <ExecutiveGrid columns={2}>
              <ExecutiveEmptyState title="Insights" message="No insights require attention." />
              <ExecutiveEmptyState title="Recommendations" message="No recommendations at this time." />
              <ExecutiveLoadingCard label="Loading executive cards..." />
              <ExecutiveIcon icon={<Sparkles size={16} />} label="ExecutiveIcon example" />
            </ExecutiveGrid>
          </ExecutiveStack>
        </ExecutiveCard>
      </div>
    </div>
  );
}
