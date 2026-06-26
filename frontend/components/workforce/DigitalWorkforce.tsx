import EmployeeGrid from "./EmployeeGrid";
import WorkforceHeader from "./WorkforceHeader";
import WorkforceSummary from "./WorkforceSummary";

export default function DigitalWorkforce() {
  return (
    <div className="space-y-8">
      <WorkforceHeader />
      <WorkforceSummary />
      <EmployeeGrid />
    </div>
  );
}

