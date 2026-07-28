import ActionBar from "./ActionBar";
import AttorneyNoteCard from "./AttorneyNoteCard";
import CaseSummaryCard from "./CaseSummaryCard";
import CommunicationCard, {
  type CommunicationModel,
} from "./CommunicationCard";
import CommunicationTimeline from "./CommunicationTimeline";
import EmployeeReasoningCard from "./EmployeeReasoningCard";
import ReviewHeader from "./ReviewHeader";

export default function ReviewWorkspaceRuntime({
  workItemId,
  reviewWork,
}: {
  workItemId: string;
  reviewWork: {
    caseSummary: {
      clientName: string;
      matterType: string;
      priority: string;
      status: string;
      assignedEmployeeName: string;
      createdTimeISO: string;
    };
    attorneyNote: string;
    employeeThinking: string;
    approval: {
      requiresApproval: boolean;
      statusLabel: string;
    };
    communication: CommunicationModel;
  };
}) {
  const { caseSummary, attorneyNote, employeeThinking, approval, communication } =
    reviewWork;

  return (
    <div className="space-y-8">
      <ReviewHeader />

      <CaseSummaryCard
        case={{
          clientName: caseSummary.clientName,
          matterType: caseSummary.matterType,
          priority: caseSummary.priority,
          status: caseSummary.status,
          assignedEmployee: caseSummary.assignedEmployeeName,
          createdTimeISO: caseSummary.createdTimeISO,
        }}
      />

      <AttorneyNoteCard note={attorneyNote} />

      <EmployeeReasoningCard recommendation={employeeThinking} />

      <CommunicationCard communication={communication} />
      <CommunicationTimeline timeline={communication.timeline} />

      <ActionBar
        workItemId={workItemId}
        approval={approval}
        communicationStatus={communication.status}
      />
    </div>
  );
}

