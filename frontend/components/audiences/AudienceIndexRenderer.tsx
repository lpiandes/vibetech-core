import AudienceDashboard from "@/components/audiences/AudienceDashboard";
import type { AudienceDashboardViewModel } from "@/lib/workspace/AudienceTypes";
import ExecutiveSurface from "@/components/executive/ExecutiveSurface";

export default function AudienceIndexRenderer({ dashboard }: { dashboard: AudienceDashboardViewModel }) {
  return (
    <ExecutiveSurface>
      <AudienceDashboard dashboard={dashboard} />
    </ExecutiveSurface>
  );
}
