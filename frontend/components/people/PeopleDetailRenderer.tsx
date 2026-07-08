import PeopleDetailLayout from "@/components/people/PeopleDetailLayout";
import type { EngagementViewModel } from "@/lib/workspace/EngagementTypes";

export default function PeopleDetailRenderer({
  businessId,
  viewModel,
}: {
  businessId: string;
  viewModel: EngagementViewModel;
}) {
  return <PeopleDetailLayout businessId={businessId} viewModel={viewModel} />;
}
