import InfoCard from "@/components/design-system/InfoCard";
import PrimaryButton from "@/components/design-system/PrimaryButton";
type EmployeeStat = {
  employeeId: string;
  name: string;
  todayCompletedCount: number;
  currentWorkload?: { waitingOnYouCount?: number };
};

export default function DashboardHeader({
  dashboardView,
  digitalWorkforceView,
}: {
  dashboardView: any;
  digitalWorkforceView: { employees: EmployeeStat[] };
}) {
  const needsYourAttentionCount =
    dashboardView?.itemsRequiringReview ?? 0;

  const employeeStats = (digitalWorkforceView?.employees ?? []).map((e) => {
    const waitingOnYouCount = e.currentWorkload?.waitingOnYouCount ?? 0;
    return {
      employee: e,
      reviewedCount: e.todayCompletedCount ?? 0,
      preparedDraftCount: e.todayCompletedCount ?? 0,
      highIntentCount: waitingOnYouCount,
    };
  });

  return (
    <section>
      <InfoCard title="Good morning Mike.">
        <div className="min-w-0">
          <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            While you were away...
          </div>

          <div className="mt-4 space-y-5">
            {employeeStats.map((s) => (
              <div key={s.employee.employeeId} className="space-y-2">
                <div className="text-sm font-semibold text-foreground">
                  {s.employee.name}
                </div>

                <div className="text-sm leading-6 text-foreground">
                  <span className="block">
                    • Reviewed {s.reviewedCount} buyer inquiries
                  </span>
                  <span className="block">
                    • Prepared {s.preparedDraftCount} draft responses
                  </span>
                  <span className="block">
                    • Flagged {s.highIntentCount} high-intent buyers
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-5 text-sm leading-6 text-foreground">
            Needs your attention on{" "}
            <span className="font-semibold">
              {needsYourAttentionCount} responses
            </span>
            .
          </div>

          <div className="mt-6 flex items-center justify-start">
            <PrimaryButton type="button" className="h-11 rounded-2xl px-6">
              Review buyer response
            </PrimaryButton>
          </div>
        </div>
      </InfoCard>
    </section>
  );
}

