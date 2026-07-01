import EmployeeCard from "./EmployeeCard";
import type { EmployeeCardModel } from "./EmployeeCard";
import { demoCompany } from "@/lib/company/demoCompany";

export default function EmployeeGrid() {
  const propertyEmployee = demoCompany.employees.find(
    (e) => e.employeeName === "Property Interest Coordinator",
  );

  const employees: EmployeeCardModel[] = propertyEmployee
    ? [
        {
          id: propertyEmployee.employeeId,
          name: propertyEmployee.employeeName,
          role: propertyEmployee.role,
          mission: propertyEmployee.mission,
          status: propertyEmployee.status,
          statusQualifier: propertyEmployee.statusQualifier,
          todayCompleted: propertyEmployee.todayCompletedCount,
          todayCompletedLine: propertyEmployee.todayAccomplishmentLine,
          approvalRatePercent: propertyEmployee.approvalRatePercent,
          approvalRateFootnote: propertyEmployee.approvalRateFootnote,
          inProgress: propertyEmployee.workload.inProgressCount,
          waitingOnYou: propertyEmployee.workload.waitingOnYouCount,
          capabilities: propertyEmployee.capabilities,
        },
      ]
    : [];

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

