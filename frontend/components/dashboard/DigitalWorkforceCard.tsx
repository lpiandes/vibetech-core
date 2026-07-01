import Avatar from "@/components/design-system/Avatar";
import InfoCard from "@/components/design-system/InfoCard";
import PrimaryButton from "@/components/design-system/PrimaryButton";
import StatusBadge from "@/components/design-system/StatusBadge";
import { demoCompany } from "@/lib/company/demoCompany";

export default function DigitalWorkforceCard() {
  const employee = demoCompany.employees.find(
    (e) => e.employeeName === "Property Interest Coordinator",
  );
  if (!employee) return null;

  return (
    <section>
      <InfoCard title={employee.employeeName}>
        <div className="flex items-start justify-between gap-6">
          <div className="flex items-start gap-4">
            <Avatar name={employee.employeeName} size={44} />

            <div className="min-w-0">
              <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                Current Status
              </div>
              <div className="mt-2">
                <StatusBadge status={employee.status} />
              </div>

              <div className="mt-4 text-xs font-medium uppercase tracking-widest text-muted-foreground">
                Completed Today
              </div>
              <div className="mt-2 text-sm leading-6 text-foreground">
                {employee.todayCompletedCount} Draft responses prepared for review
              </div>

              <div className="mt-4 text-xs font-medium uppercase tracking-widest text-muted-foreground">
                Pending Reviews
              </div>
              <div className="mt-2 text-sm leading-6 text-foreground">
                {employee.workload.waitingOnYouCount} buyer responses waiting for your governance
              </div>
            </div>
          </div>

          <div className="shrink-0 pt-1">
            <PrimaryButton type="button" className="h-11 rounded-2xl px-5">
              Review buyer response
            </PrimaryButton>
          </div>
        </div>
      </InfoCard>
    </section>
  );
}

