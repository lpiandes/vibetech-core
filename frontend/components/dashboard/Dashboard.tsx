import ImpactMetrics from "./ImpactMetrics";
import DashboardHeader from "./DashboardHeader";
import DigitalWorkforceCard from "./DigitalWorkforceCard";
import RecentActivity from "./RecentActivity";
import QuickActions from "./QuickActions";

export default function Dashboard() {
  return (
    <div className="space-y-8">
      <DashboardHeader />
      <ImpactMetrics />
      <DigitalWorkforceCard />
      <RecentActivity />
      <QuickActions />
    </div>
  );
}

