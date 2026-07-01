import EmployeeCard from "./EmployeeCard";
import type { EmployeeCardModel } from "./EmployeeCard";
import { WorkspaceService } from "@/lib/workspace/WorkspaceService";

export default function EmployeeGrid() {
  const service = new WorkspaceService();
  const view = service.loadDigitalWorkforce();

  const employees: EmployeeCardModel[] = (view.employees ?? []).map((e: any) => ({
    id: e.employeeId,
    name: e.name,
    role: e.role,
    mission: undefined,
    status: e.status,
    statusQualifier: e.statusQualifier,
    todayCompleted: e.todayCompletedCount,
    todayCompletedLine: e.todayAccomplishmentLine,
    approvalRatePercent: e.approvalRatePercent,
    approvalRateFootnote: e.approvalRateFootnote,
    inProgress: e.currentWorkload?.inProgressCount ?? 0,
    waitingOnYou: e.currentWorkload?.waitingOnYouCount ?? 0,
    capabilities: e.capabilities,
  }));

  return (
    <section>
      <div className="space-y-5">
        {employees.map((e) => (
          <EmployeeCard key={e.id} employee={e} />
        ))}
      </div>
    </section>
  );
}

