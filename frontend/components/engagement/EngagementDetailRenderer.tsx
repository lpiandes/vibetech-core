import EngagementPartyDetail from "@/components/engagement/EngagementPartyDetail";
import type { EngagementViewModel } from "@/lib/workspace/EngagementTypes";

export default function EngagementDetailRenderer({ viewModel }: { viewModel: EngagementViewModel }) {
  return <EngagementPartyDetail viewModel={viewModel} />;
}
