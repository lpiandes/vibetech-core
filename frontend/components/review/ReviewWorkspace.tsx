import ActionBar from "./ActionBar";
import AttorneyNoteCard from "./AttorneyNoteCard";
import CaseSummaryCard from "./CaseSummaryCard";
import CommunicationCard, {
  type CommunicationModel,
} from "./CommunicationCard";
import CommunicationTimeline from "./CommunicationTimeline";
import EmployeeReasoningCard from "./EmployeeReasoningCard";
import FeedbackCard from "./FeedbackCard";
import ReviewHeader from "./ReviewHeader";

export { default } from "./ReviewWorkspaceRuntime";

export function ReviewWorkspaceLegacy({
  workItemId,
}: {
  workItemId?: string;
}) {
  type WorkMock = {
    buyerName: string;
    propertySummary: string;
    priority: "High" | "Medium" | "Low";
    status: "Needs Review" | "Approved" | "Completed";
    createdTimeISO: string;
    highlights: string[];
    considerations: string[];
    employeeThinking: string;
    draftEmail: string;
    approval: { requiresApproval: boolean; statusLabel: string };
  };

  const propertyWorksById: Record<string, WorkMock> = {
    pm1: {
      buyerName: "John Smith",
      propertySummary: "68 Mystic Meadow Lane • Hartford, CT",
      priority: "High",
      status: "Needs Review",
      createdTimeISO: "2026-06-25T13:15:00.000Z",
      highlights: [
        "Updated kitchen and open-plan living",
        "Bright, natural light throughout",
        "Walkable to local amenities",
      ],
      considerations: [
        "Confirm timeline for closing and key milestones",
        "Review any HOA items that may affect next steps",
        "Check zoning constraints for planned renovations",
      ],
      employeeThinking:
        "This buyer submitted an inquiry for 68 Mystic Meadow Lane. Based on the buyer’s message and the property details, I recommend responding today while interest is high—while clearly confirming the most important next steps and any timing questions the buyer raised.",
      draftEmail:
        "Subject: Next steps for 68 Mystic Meadow Lane\n\nHello John,\n\nThanks for your interest in 68 Mystic Meadow Lane in Hartford. Here’s what we have so far, and the best next steps to keep things moving:\n\nProperty highlights\n- Updated kitchen and open-plan living\n- Bright, natural light throughout\n- Walkable to local amenities\n\nBuyer considerations\n- We’ll confirm your timeline for closing and key milestones\n- We’ll review any HOA items that may affect next steps\n- We’ll check zoning constraints for any planned renovations\n\nIf you’d like, reply with your preferred timing for a walkthrough and whether there are any specific items you want to prioritize.\n\nWarm regards,\nProperty Interest Coordinator\n",
      approval: { requiresApproval: true, statusLabel: "Pending Review" },
    },
    pm2: {
      buyerName: "Sarah Johnson",
      propertySummary: "15 Oak Street • Hartford, CT",
      priority: "Medium",
      status: "Needs Review",
      createdTimeISO: "2026-06-25T14:05:00.000Z",
      highlights: [
        "Quiet street setting",
        "Flexible layout for changing needs",
        "Strong potential for value-focused updates",
      ],
      considerations: [
        "Confirm the buyer’s ideal move-in timeframe",
        "Clarify any questions on planned updates",
      ],
      employeeThinking:
        "This buyer is asking for a clear plan after reviewing 15 Oak Street. I recommend a professional response today that confirms key details, addresses timeline questions, and invites the buyer’s preferred next step—so governance stays aligned and communication stays calm.",
      draftEmail:
        "Subject: Your next steps for 15 Oak Street\n\nHello Sarah,\n\nThanks for reaching out about 15 Oak Street in Hartford. To keep everything moving smoothly, here are the property highlights and the items we should confirm next:\n\nProperty highlights\n- Quiet street setting\n- Flexible layout for changing needs\n- Strong potential for value-focused updates\n\nBuyer considerations\n- We’ll confirm your ideal move-in timeframe\n- We’ll clarify any questions you have about planned updates\n\nReply when you’re ready with your preferred timing for a walkthrough, and we’ll coordinate the next steps.\n\nSincerely,\nProperty Interest Coordinator\n",
      approval: { requiresApproval: true, statusLabel: "Pending Review" },
    },
    pm3: {
      buyerName: "Michael Davis",
      propertySummary: "22 Harbor View • Hartford, CT",
      priority: "Medium",
      status: "Needs Review",
      createdTimeISO: "2026-06-25T11:50:00.000Z",
      highlights: [
        "Scenic views from key rooms",
        "Comfortable living space with room to expand",
      ],
      considerations: [
        "Confirm renovation goals and any timing constraints",
        "Check whether external updates could affect next steps",
      ],
      employeeThinking:
        "The buyer is interested in 22 Harbor View and is expecting a timely response. I recommend responding today with a structured email that confirms key property details, summarizes what we need to align next steps, and keeps communication governance-ready.",
      draftEmail:
        "Subject: Guidance for 22 Harbor View\n\nHello Michael,\n\nThank you for your inquiry about 22 Harbor View in Hartford. Below is a structured overview and the most helpful next steps so we can align quickly:\n\nProperty highlights\n- Scenic views from key rooms\n- Comfortable living space with room to expand\n\nBuyer considerations\n- Confirm your renovation goals and any timing constraints\n- Check whether external updates could affect next steps\n\nIf you’d like, share your preferred timing for a walkthrough and any priorities you want us to address first.\n\nBest regards,\nProperty Interest Coordinator\n",
      approval: { requiresApproval: true, statusLabel: "Pending Review" },
    },
  };

  const _legalWorksById: Record<string, WorkMock> = {
    q1: {
      buyerName: "Thompson Group",
      propertySummary: "Buyer Response Draft",
      priority: "High",
      status: "Needs Review",
      createdTimeISO: "2026-06-25T13:15:00.000Z",
      highlights: ["Inquiry received", "Clear next steps drafted"],
      considerations: ["Confirm timing for review", "Align response to latest guidance"],
      employeeThinking:
        "An inquiry has been received. I recommend drafting a response today while interest is high, keeping the next step clear and aligned with governance requirements.",
      draftEmail:
        "Subject: Buyer response draft\n\nHello,\n\nThanks for the update. Here are the next steps we can align on today.\n\nProperty highlights\n- Inquiry received\n- Clear next steps drafted\n\nBuyer considerations\n- Confirm timing for review\n- Align response to latest guidance\n\nSincerely,\nUpdate Coordinator\n",
      approval: { requiresApproval: true, statusLabel: "Pending Review" },
    },
    q2: {
      buyerName: "Harborstone Office",
      propertySummary: "Buyer Communication Draft",
      priority: "Medium",
      status: "Needs Review",
      createdTimeISO: "2026-06-25T14:05:00.000Z",
      highlights: ["Update requested", "Draft response prepared"],
      considerations: ["Confirm preferred timing", "Ensure governance alignment"],
      employeeThinking:
        "The buyer requested an update. I recommend responding with a professional summary and next-step guidance to keep governance aligned and communication calm.",
      draftEmail:
        "Subject: Update requested\n\nHello,\n\nThanks for your request. Here’s a clear plan for next steps.\n\nProperty highlights\n- Update requested\n- Draft response prepared\n\nBuyer considerations\n- Confirm preferred timing\n- Ensure governance alignment\n\nWarm regards,\nUpdate Coordinator\n",
      approval: { requiresApproval: true, statusLabel: "Pending Review" },
    },
  };

  // Property mode only in this sprint (ABC Property Group mock data).
  const worksById = propertyWorksById;

  const defaultId = "pm1";
  const workItem = worksById[workItemId ?? defaultId] ?? worksById[defaultId];

  return (
    <div className="space-y-8">
      <ReviewHeader />

      <CaseSummaryCard
        case={{
          clientName: workItem.buyerName,
          matterType: workItem.propertySummary,
          priority: workItem.priority,
          status: workItem.status,
          assignedEmployee: "Property Interest Coordinator",
          createdTimeISO: workItem.createdTimeISO,
        }}
      />

      <AttorneyNoteCard
        note={[
          "Property Highlights:",
          ...(workItem.highlights.map((h) => `- ${h}`) || []),
          "",
          "Buyer Considerations:",
          ...(workItem.considerations.map((c) => `- ${c}`) || []),
        ].join("\n")}
      />

      <EmployeeReasoningCard recommendation={workItem.employeeThinking} />
      {(() => {
        const draft = String(workItem.draftEmail ?? "");
        const lines = draft.split(/\r?\n/);
        const subjectLineIdx = lines.findIndex((l) => /^Subject:/i.test(l));
        const subject =
          subjectLineIdx >= 0
            ? lines[subjectLineIdx].replace(/^Subject:/i, "").trim() || "Buyer response"
            : "Buyer response";

        const bodyLines =
          subjectLineIdx >= 0 ? lines.slice(subjectLineIdx + 1) : lines;
        while (bodyLines.length && bodyLines[0].trim().length === 0) bodyLines.shift();

        const created = workItem.createdTimeISO;
        const addMinutes = (iso: string, minutes: number) => {
          const d = new Date(iso);
          d.setUTCMinutes(d.getUTCMinutes() + minutes);
          return d.toISOString();
        };

        const reviewRequired = Boolean(workItem.approval?.requiresApproval);
        const communicationStatus = reviewRequired ? "PENDING_APPROVAL" : "APPROVED";

        const communication: CommunicationModel = {
          communicationId: `comm_${workItemId ?? defaultId}`,
          channel: "email",
          status: communicationStatus,
          recipient: workItem.buyerName,
          subject,
          body: bodyLines.join("\n"),
          createdAt: created,
          reviewRequired,
          timeline: reviewRequired
            ? [
                {
                  timestampISO: created,
                  status: "DRAFT",
                  action: "Draft Created",
                  object: workItem.buyerName,
                },
                {
                  timestampISO: addMinutes(created, 1),
                  status: "PENDING_APPROVAL",
                  action: "Review Required",
                  object: workItem.buyerName,
                },
              ]
            : [
                {
                  timestampISO: created,
                  status: "APPROVED",
                  action: "Approved",
                  object: workItem.buyerName,
                },
              ],
        };

        return (
          <>
            <CommunicationCard communication={communication} />
            <CommunicationTimeline timeline={communication.timeline} />
          </>
        );
      })()}
      <FeedbackCard />
      <ActionBar
        workItemId={String(workItemId ?? defaultId)}
        approval={workItem.approval}
        communicationStatus={
          workItem.approval.requiresApproval ? "PENDING_APPROVAL" : "APPROVED"
        }
      />
    </div>
  );
}

