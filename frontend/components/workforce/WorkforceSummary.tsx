import InfoCard from "@/components/design-system/InfoCard";
import MetricCard from "@/components/design-system/MetricCard";
import SectionHeader from "@/components/design-system/SectionHeader";
import StatusBadge from "@/components/design-system/StatusBadge";
import { getWorkspaceService } from "@/lib/workspace/getWorkspaceService";

export default function WorkforceSummary() {
  const service = getWorkspaceService();
  const view = service.loadDigitalWorkforce();
  const mock = view.workforceSummary;

  return (
    <section>
      <SectionHeader
        title="Workforce Summary"
        subtitle={
          "Buyer-ready work and governance demand."
        }
      />

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <InfoCard title="Work today">
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-4">
              <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                Employees
              </div>
              <div className="text-sm font-semibold text-foreground">
                {mock.employeesWorkingCount +
                  mock.employeesNeedingReviewCount +
                  mock.employeesOfflineCount}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status="Working" />
              <div className="text-sm text-muted-foreground">
                {mock.employeesWorkingCount}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status="Needs Review" />
              <div className="text-sm text-muted-foreground">
                {mock.employeesNeedingReviewCount}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status="Offline" />
              <div className="text-sm text-muted-foreground">
                {mock.employeesOfflineCount}
              </div>
            </div>
          </div>
        </InfoCard>

        <div className="grid gap-4 sm:grid-cols-2">
          <MetricCard
            label="Buyer-ready work completed"
            value={mock.todayTasksCompletedCount}
            footnote={
              "Work prepared and ready for review."
            }
          />
          <MetricCard
            label="Hours Saved Today"
            value={mock.hoursSavedToday}
            suffix="hrs"
            footnote="Estimated time saved from employee-ready work."
          />
        </div>
      </div>
    </section>
  );
}

