import InfoCard from "@/components/design-system/InfoCard";
import MetricCard from "@/components/design-system/MetricCard";
import SectionHeader from "@/components/design-system/SectionHeader";
import StatusBadge from "@/components/design-system/StatusBadge";
import { demoCompany } from "@/lib/company/demoCompany";

export default function WorkforceSummary() {
  const employeesWorkingCount = demoCompany.employees.filter(
    (e) => e.status === "Working",
  ).length;
  const employeesNeedingReviewCount = demoCompany.employees.filter(
    (e) => e.status === "Needs Review",
  ).length;
  const employeesOfflineCount = demoCompany.employees.filter(
    (e) => e.status === "Offline",
  ).length;

  const tasksCompleted = demoCompany.employees.reduce(
    (sum, e) => sum + e.todayCompletedCount,
    0,
  );

  const hoursSaved = demoCompany.companyData.hoursSavedToday;

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
                {demoCompany.employees.length}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status="Working" />
              <div className="text-sm text-muted-foreground">
                {employeesWorkingCount}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status="Needs Review" />
              <div className="text-sm text-muted-foreground">
                {employeesNeedingReviewCount}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status="Offline" />
              <div className="text-sm text-muted-foreground">
                {employeesOfflineCount}
              </div>
            </div>
          </div>
        </InfoCard>

        <div className="grid gap-4 sm:grid-cols-2">
          <MetricCard
            label="Buyer-ready work completed"
            value={tasksCompleted}
            footnote={
              "Work prepared and ready for review."
            }
          />
          <MetricCard
            label="Hours Saved Today"
            value={hoursSaved}
            suffix="hrs"
            footnote="Estimated time saved from employee-ready work."
          />
        </div>
      </div>
    </section>
  );
}

