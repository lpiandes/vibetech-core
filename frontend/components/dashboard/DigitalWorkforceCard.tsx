import Avatar from "@/components/design-system/Avatar";
import InfoCard from "@/components/design-system/InfoCard";
import StatusBadge from "@/components/design-system/StatusBadge";
import { demoCompany } from "@/lib/company/demoCompany";

export default function DigitalWorkforceCard() {
  const totalCompleted = demoCompany.employees.reduce(
    (sum, e) => sum + e.todayCompletedCount,
    0,
  );
  const totalCompletedSafe = totalCompleted || 1;
  const hoursSavedToday = demoCompany.companyData.hoursSavedToday;

  const formatTime = (iso: string) => new Date(iso).toISOString().slice(11, 16);

  const employees = demoCompany.employees;
  const inquiries = demoCompany.companyData.inquiries;

  return (
    <section>
      <div className="space-y-5">
        {employees.map((e) => {
          const employeeInquiries = inquiries.filter(
            (i) => i.employeeName === e.employeeName,
          );
          const startedAt =
            employeeInquiries
              .map((i) => i.submittedAtISO)
              .sort()
              .at(0) ?? employeeInquiries[0]?.createdTimeISO;

          const startedValue = startedAt ? formatTime(startedAt) : "Today";

          const hoursReturned =
            (hoursSavedToday * e.todayCompletedCount) / totalCompletedSafe;

          return (
            <InfoCard key={e.employeeId} title={e.employeeName}>
              <div className="flex items-start justify-between gap-6">
                <div className="flex items-start gap-4">
                  <Avatar name={e.employeeName} size={44} />

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
                      {e.workload.waitingOnYouCount} responses
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

