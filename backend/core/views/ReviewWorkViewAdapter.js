/**
 * ReviewWorkViewAdapter
 *
 * Contract-only transformer:
 * - Calls DraftGenerator to obtain runtime + draft outputs
 * - Transforms them into the business model expected by docs/contracts/ReviewWorkContract.md
 * - Does NOT expose runtime objects, prompts, pipeline, or provider details
 */

export class ReviewWorkViewAdapter {
  /**
   * @param {object} params
   * @param {DraftGenerator} params.DraftGenerator
   */
  constructor({ DraftGenerator } = {}) {
    if (!DraftGenerator) throw new Error("ReviewWorkViewAdapter requires DraftGenerator.");
    this.DraftGenerator = DraftGenerator;
  }

  /**
   * @param {object} input
   * @param {any} input.runtimeInput
   * @param {string} input.employeeFolderPath
   * @param {string} input.attorneyNote
   * @param {string} input.clientName
   * @returns {Promise<object>} ReviewWorkResponse business contract
   */
  async toReviewWorkResponse({
    runtimeInput,
    employeeFolderPath,
    attorneyNote,
    clientName,
    workItemId,
  }) {
    const result = await this.DraftGenerator.generate({
      runtimeInput,
      employeeFolderPath,
      attorneyNote,
      clientName,
    });

    const runtime = result?.runtime ?? {};

    const createdTimeISO = "2026-06-25T14:30:00.000Z";
    const placeholderMatterType = "Property Inquiry";
    const assignedEmployeeName = "Property Interest Coordinator";

    const isUrgent = Boolean(runtimeInput?.isUrgent);
    const priority = isUrgent ? "High" : "Medium";

    const requiresApproval = Boolean(runtime?.requiresApproval);
    const status = requiresApproval ? "Needs Review" : "Approved";

    const situation = runtime?.situation;
    const employeeThinking = (() => {
      switch (situation) {
        case "CLIENT_REQUESTED_UPDATE":
          return "The client requested an update; I drafted a focused communication to keep the client aligned with current case context.";
        case "LONG_TIME_WITHOUT_UPDATE":
          return "It has been a while since the last client update; I prepared a reassuring draft to provide timely context and clarity.";
        case "WAITING_ON_EXTERNAL_PARTY":
          return "We are waiting on external information; I drafted a holding communication and structured next steps around what we still need.";
        case "URGENT_CASE_ACTIVITY":
        case "ESCALATE":
          return "This is urgent; the draft is prepared for governance review so attorney guidance can confirm what should be communicated.";
        default:
          return "I prepared this work for governance review based on the current case moment and the information available.";
      }
    })();

    const draftId = "draft_1";
    const draftTitle = "Draft Preview";
    const generatedTimeISO = "2026-06-25T14:30:00.000Z";

    const rawDraft = String(result?.draft ?? "");
    // Remove any development traces to avoid leaking prompt/provider internals.
    const sanitizedDraft = rawDraft
      .replace(/\n?Trace:[\s\S]*$/m, "")
      // Demo draft strings often include “what will happen next” sections
      // referencing internal roadmap components; strip them for business-only display.
      .replace(/\n\nWhat will happen next[\s\S]*$/m, "")
      // Remove provider-specific wording from demo drafts.
      .replace(/produced by the demo LLM provider/gi, "produced as a local-development placeholder")
      .trimEnd();

    const draft = {
      draftId,
      title: draftTitle,
      content: sanitizedDraft,
      generatedTimeISO,
    };

    const approval = {
      approvalRequestId: "approval_1",
      workItemId: String(workItemId ?? "workItem_demo"),
      requiresApproval,
      approvalType: "Attorney Approval",
      statusLabel: requiresApproval ? "Pending Review" : "Completed",
      primaryAction: requiresApproval ? "Approve" : "Approve",
      secondaryAction: requiresApproval ? "Request Changes" : "",
      governanceNote: requiresApproval
        ? "This draft requires governance review before it moves forward."
        : "This draft is ready within governance boundaries.",
    };

    return {
      caseSummary: {
        clientName: String(clientName ?? ""),
        matterType: placeholderMatterType,
        priority,
        status,
        assignedEmployeeName,
        createdTimeISO,
      },
      attorneyNote: String(attorneyNote ?? ""),
      employeeThinking,
      draft,
      approval,
      activities: [],
    };
  }
}

