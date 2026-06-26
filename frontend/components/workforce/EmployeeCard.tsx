import Avatar from "@/components/design-system/Avatar";

import EmployeeCapabilities from "./EmployeeCapabilities";
import EmployeeMetrics from "./EmployeeMetrics";
import EmployeeCTA from "./EmployeeCTA";
import EmployeeStatus from "./EmployeeStatus";

export type EmployeeCardModel = {
  id: string;
  name: string;
  role: string;
  status: "Working" | "Needs Review" | "Approved" | "Completed" | "Offline";
  statusQualifier: string;
  todayCompleted: number;
  todayCompletedLine: string;
  approvalRatePercent: number;
  approvalRateFootnote: string;
  inProgress: number;
  waitingOnYou: number;
  capabilities: string[];
};

export default function EmployeeCard({
  employee,
}: {
  employee: EmployeeCardModel;
}) {
  const needsReview = employee.waitingOnYou > 0;

  return (
    <div className="rounded-3xl border border-border bg-background p-6 shadow-sm">
      <div className="flex items-start justify-between gap-6">
        <div className="flex min-w-0 items-start gap-4">
          <Avatar name={employee.name} size={44} />

          <div className="min-w-0 flex-1">
            <div className="truncate text-xl font-semibold tracking-tight text-foreground">
              {employee.name}
            </div>
            <div className="mt-1 text-sm text-muted-foreground">
              {employee.role}
            </div>

            <div className="mt-4">
              <EmployeeStatus
                status={employee.status}
                qualifier={employee.statusQualifier}
                waitingOnYou={employee.waitingOnYou}
                needsReview={needsReview}
              />
            </div>

            <div className="mt-4">
              <EmployeeMetrics
                todayCompleted={employee.todayCompleted}
                todayCompletedLine={employee.todayCompletedLine}
                approvalRatePercent={employee.approvalRatePercent}
                approvalRateFootnote={employee.approvalRateFootnote}
                inProgress={employee.inProgress}
                waitingOnYou={employee.waitingOnYou}
              />
            </div>

            <div className="mt-4">
              <EmployeeCapabilities capabilities={employee.capabilities} />
            </div>
          </div>
        </div>

        <div className="shrink-0">
          <EmployeeCTA />

          <div className="mt-3 text-xs leading-5 text-muted-foreground">
            {needsReview
              ? "Waiting on your governance."
              : "No review required right now."}
          </div>
        </div>
      </div>
    </div>
  );
}

