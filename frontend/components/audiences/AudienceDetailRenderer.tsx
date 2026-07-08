import AudienceDetail from "@/components/audiences/AudienceDetail";
import type { AudienceDashboardViewModel, AudienceSummaryViewModel } from "@/lib/workspace/AudienceTypes";
import ExecutiveSurface from "@/components/executive/ExecutiveSurface";

export default function AudienceDetailRenderer({
  dashboard,
  audience,
  segmentId,
}: {
  dashboard: AudienceDashboardViewModel;
  audience: AudienceSummaryViewModel | null;
  segmentId: string;
}) {
  return (
    <ExecutiveSurface>
      <AudienceDetail dashboard={dashboard} audience={audience} segmentId={segmentId} />
    </ExecutiveSurface>
  );
}
