import ActionBar from "./ActionBar";
import AttorneyNoteCard from "./AttorneyNoteCard";
import CaseSummaryCard from "./CaseSummaryCard";
import DraftPreviewCard from "./DraftPreviewCard";
import EmployeeReasoningCard from "./EmployeeReasoningCard";
import FeedbackCard from "./FeedbackCard";
import ReviewHeader from "./ReviewHeader";

export default function ReviewWorkspace() {
  // Product-design sprint: visual-only mock data (no backend, no approvals logic).
  const mock = {
    case: {
      clientName: "John Smith",
      matterType: "Settlement Negotiation",
      priority: "High",
      status: "Needs Review",
      assignedEmployee: "Client Update Employee",
      createdTimeISO: "2026-06-25T14:30:00.000Z",
    },
    attorneyNote:
      "Settlement offer received from opposing counsel this afternoon.",
    employeeRecommendation:
      "I recommend drafting a client update because a meaningful settlement development has occurred and the client would reasonably expect timely information.",
    draftPreview:
      "Subject: Settlement Offer Update\n\nHello John,\n\nI’m writing to share an update regarding your matter. We have received a settlement offer from opposing counsel this afternoon. We are reviewing the terms and will provide the next steps as soon as we have attorney guidance.\n\nThank you,\nClient Update Employee\n",
    approval: {
      requiresAttorneyApproval: true,
      statusLabel: "Pending Review",
    },
  };

  return (
    <div className="space-y-8">
      <ReviewHeader />

      <CaseSummaryCard case={mock.case} />
      <AttorneyNoteCard note={mock.attorneyNote} />
      <EmployeeReasoningCard recommendation={mock.employeeRecommendation} />
      <DraftPreviewCard draft={mock.draftPreview} />
      <FeedbackCard />
      <ActionBar approval={mock.approval} />
    </div>
  );
}

