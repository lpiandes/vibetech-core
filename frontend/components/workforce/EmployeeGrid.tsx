import EmployeeCard from "./EmployeeCard";
import type { EmployeeCardModel } from "./EmployeeCard";

const mockEmployees: EmployeeCardModel[] = [
  {
    id: "e1",
    name: "Client Success Coordinator",
    role: "Client Updates & Readiness",
    status: "Working",
    statusQualifier: "Preparing updates for governance",
    todayCompleted: 7,
    todayCompletedLine:
      "Completed client update drafts and prepared them for review.",
    approvalRatePercent: 94,
    approvalRateFootnote: "Based on your past week’s approvals.",
    inProgress: 4,
    waitingOnYou: 0,
    capabilities: ["Client Updates", "Settlement Readiness", "Clarity Checks"],
  },
  {
    id: "e2",
    name: "Settlement Coordinator",
    role: "Settlement Negotiation Support",
    status: "Needs Review",
    statusQualifier: "Compiling terms for attorney governance",
    todayCompleted: 5,
    todayCompletedLine:
      "Drafted a concise settlement update aligned to the latest timeline.",
    approvalRatePercent: 88,
    approvalRateFootnote: "Based on reviewed items over the last 7 days.",
    inProgress: 3,
    waitingOnYou: 2,
    capabilities: ["Negotiation Drafts", "Term Alignment", "Risk Framing"],
  },
  {
    id: "e3",
    name: "Insurance Specialist",
    role: "Evidence & Correspondence",
    status: "Offline",
    statusQualifier: "Waiting on external materials",
    todayCompleted: 3,
    todayCompletedLine:
      "Staged evidence requests and prepared follow-up drafts for next steps.",
    approvalRatePercent: 91,
    approvalRateFootnote: "Based on approvals of related correspondence.",
    inProgress: 1,
    waitingOnYou: 1,
    capabilities: ["Evidence Intake", "Correspondence Drafts", "Compliance Notes"],
  },
  {
    id: "e4",
    name: "Intake Coordinator",
    role: "Document Intake & Triage",
    status: "Working",
    statusQualifier: "Organizing inputs for drafting",
    todayCompleted: 8,
    todayCompletedLine:
      "Collected and normalized intake details for downstream drafting.",
    approvalRatePercent: 96,
    approvalRateFootnote: "Based on your last week’s review outcomes.",
    inProgress: 5,
    waitingOnYou: 0,
    capabilities: ["Intake Triage", "Timeline Extraction", "Document Prep"],
  },
];

export default function EmployeeGrid() {
  return (
    <section>
      <div className="space-y-5">
        {mockEmployees.map((e) => (
          <EmployeeCard key={e.id} employee={e} />
        ))}
      </div>
    </section>
  );
}

