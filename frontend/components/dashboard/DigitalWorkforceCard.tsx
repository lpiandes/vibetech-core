import Avatar from "@/components/design-system/Avatar";
import InfoCard from "@/components/design-system/InfoCard";
import StatusBadge from "@/components/design-system/StatusBadge";

export default function DigitalWorkforceCard({
  employees,
  activityFeed,
  hoursSavedToday,
}: {
  employees: Array<{
    employeeId: string;
    name: string;
    role: string;
    status: "Working" | "Offline" | "Needs Review" | "Approved" | "Completed";
    statusQualifier: string;
    todayCompletedCount: number;
    todayAccomplishmentLine: string;
    approvalRatePercent: number;
    approvalRateFootnote: string;
    currentWorkload?: { inProgressCount: number; waitingOnYouCount: number };
    capabilities?: string[];
    primaryActionLabel?: string;
  }>;
  activityFeed: Array<{
    time: string;
    employee: string;
    activity: string;
    object: string;
  }>;
  hoursSavedToday: number;
}) {
  const totalCompleted = employees.reduce(
    (sum, e) => sum + (e.todayCompletedCount ?? 0),
    0,
  );
  const totalCompletedSafe = totalCompleted || 1;

  return (
    <section>
      <div className="space-y-5">
        {employees.map((e) => {
          const employeeFeed = activityFeed.filter((a) => a.employee === e.name);
          const startedValue = employeeFeed.length ? employeeFeed[0]?.time : "Today";

          const hoursReturned =
            (hoursSavedToday * (e.todayCompletedCount ?? 0)) / totalCompletedSafe;

          return (
            <InfoCard key={e.employeeId} title={e.name}>
              <div className="flex items-start justify-between gap-6">
                <div className="flex items-start gap-4">
                  <Avatar name={e.name} size={44} />

                  <div className="min-w-0">
                    <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                      Currently Working
                    </div>
                    <div className="mt-2">
                      <StatusBadge status={e.status} />
                    </div>

                    <div className="mt-4 text-xs font-medium uppercase tracking-widest text-muted-foreground">
                      Current Task
                    </div>
                    <div className="mt-2 text-sm leading-6 text-foreground">
                      {e.role}
                    </div>

                    <div className="mt-4 text-xs font-medium uppercase tracking-widest text-muted-foreground">
                      Started
                    </div>
                    <div className="mt-2 text-sm leading-6 text-foreground">
                      {startedValue}
                    </div>

                    <div className="mt-4 text-xs font-medium uppercase tracking-widest text-muted-foreground">
                      Waiting For You
                    </div>
                    <div className="mt-2 text-sm leading-6 text-foreground">
                      {e.currentWorkload?.waitingOnYouCount ?? 0} responses
                    </div>
                  </div>
                </div>

                <div className="shrink-0">
                  <div className="text-right text-xs font-medium uppercase tracking-widest text-muted-foreground">
                    Completed Today
                  </div>
                  <div className="mt-2 text-right text-2xl font-semibold tracking-tight text-foreground">
                    {e.todayCompletedCount}
                  </div>

                  <div className="mt-4 text-right text-xs font-medium uppercase tracking-widest text-muted-foreground">
                    Hours Returned
                  </div>
                  <div className="mt-2 text-right text-sm leading-6 text-foreground">
                    {hoursReturned.toFixed(1)} hrs
                  </div>

                  <div className="mt-4 text-right text-xs font-medium uppercase tracking-widest text-muted-foreground">
                    Approval Rate
                  </div>
                  <div className="mt-2 text-right text-sm leading-6 text-foreground">
                    {e.approvalRatePercent}%
                  </div>
                </div>
              </div>
            </InfoCard>
          );
        })}
      </div>
    </section>
  );
}

