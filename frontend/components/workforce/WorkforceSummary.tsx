import InfoCard from "@/components/design-system/InfoCard";
import MetricCard from "@/components/design-system/MetricCard";
import SectionHeader from "@/components/design-system/SectionHeader";
import StatusBadge from "@/components/design-system/StatusBadge";

export default function WorkforceSummary() {
  // Mock data (documentation + v1 visual-only implementation).
  const mock = {
    employees: 4,
    working: 2,
    needsReview: 1,
    offline: 1,
    tasksCompleted: 23,
    hoursSaved: 18.4,
  };

  return (
    <section>
      <SectionHeader
        title="Workforce Summary"
        subtitle="Employees, review demand, and today’s outcomes."
      />

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <InfoCard title="Work today">
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-4">
              <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                Employees
              </div>
              <div className="text-sm font-semibold text-foreground">
                {mock.employees}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status="Working" />
              <div className="text-sm text-muted-foreground">
                {mock.working}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status="Needs Review" />
              <div className="text-sm text-muted-foreground">
                {mock.needsReview}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status="Offline" />
              <div className="text-sm text-muted-foreground">
                {mock.offline}
              </div>
            </div>
          </div>
        </InfoCard>

        <div className="grid gap-4 sm:grid-cols-2">
          <MetricCard
            label="Today’s Tasks Completed"
            value={mock.tasksCompleted}
            footnote="Work finished by your Digital Employees and ready for governance."
          />
          <MetricCard
            label="Hours Saved Today"
            value={mock.hoursSaved}
            suffix="hrs"
            footnote="Estimated time saved from employee-ready work."
          />
        </div>
      </div>
    </section>
  );
}

