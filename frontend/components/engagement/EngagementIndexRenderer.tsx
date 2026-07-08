import PeopleExecutiveLayout from "@/components/people/PeopleExecutiveLayout";
import type { EngagementPartyIndexViewModel } from "@/lib/workspace/EngagementTypes";

export default function EngagementIndexRenderer({ index }: { index: EngagementPartyIndexViewModel }) {
  return <PeopleExecutiveLayout index={index} />;
}
