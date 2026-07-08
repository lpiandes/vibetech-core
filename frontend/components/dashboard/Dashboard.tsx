import DashboardHeader from "./DashboardHeader";
import DigitalWorkforceCard from "./DigitalWorkforceCard";
import LiveActivityFeed, {
  type LiveActivityEntry,
} from "./LiveActivityFeed";
import QuickActions from "./QuickActions";
import { getWorkspaceService } from "@/lib/workspace/getWorkspaceService";

export default function Dashboard() {
  const service = getWorkspaceService();
  const dashboardView = service.loadDashboard();
  const digitalWorkforceView = service.loadDigitalWorkforce();
  const timelineEntries: LiveActivityEntry[] = dashboardView.activityFeed ?? [];

  return (
    <div className="space-y-8">
      <DashboardHeader
        dashboardView={dashboardView}
        digitalWorkforceView={digitalWorkforceView}
      />
      <DigitalWorkforceCard
        employees={digitalWorkforceView.employees}
        activityFeed={timelineEntries}
        hoursSavedToday={dashboardView.impactMetrics.hoursSaved}
      />
      <LiveActivityFeed entries={timelineEntries} />
      <QuickActions />
    </div>
  );
}

