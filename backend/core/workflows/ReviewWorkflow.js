/**
 * ReviewWorkflow
 *
 * Local orchestration only:
 * - calls ReviewWorkViewAdapter
 * - accepts approval decisions (APPROVE / REJECT)
 * - records approvals in-memory (no persistence)
 * - marks the work item as completed by updating business contract fields
 */

export class ReviewWorkflow {
  constructor({ ReviewWorkViewAdapter } = {}) {
    if (!ReviewWorkViewAdapter) {
      throw new Error("ReviewWorkflow requires ReviewWorkViewAdapter.");
    }

    this.ReviewWorkViewAdapter = ReviewWorkViewAdapter;
    /** @type {Map<string, { response: any, decision?: string }>} */
    this.sessions = new Map();
  }

  /**
   * Creates a review task and returns the initial ReviewWorkResponse.
   * @param {object} input
   * @param {any} input.runtimeInput
   * @param {string} input.employeeFolderPath
   * @param {string} input.attorneyNote
   * @param {string} input.clientName
   * @returns {Promise<object>} ReviewWorkResponse business contract
   */
  async createReviewTask({
    runtimeInput,
    employeeFolderPath,
    attorneyNote,
    clientName,
    workItemId,
    companyRuntime,
    communicationChannel = "email",
  }) {
    const response = await this.ReviewWorkViewAdapter.toReviewWorkResponse({
      runtimeInput,
      employeeFolderPath,
      attorneyNote,
      clientName,
      workItemId,
    });

    const key = String(response?.approval?.workItemId ?? workItemId ?? "workItem_demo");
    this.sessions.set(key, { response });

    // Create DRAFT communication as a first-class business object.
    if (companyRuntime) {
      const { CommunicationEngine } = await import("../communication/CommunicationEngine.js");

      const communicationEngine = new CommunicationEngine({ runtime: companyRuntime });
      const communicationId = `comm_${key}`;

      const draftContent = String(response?.draft?.content ?? "");
      const { subject, body } = (() => {
        const lines = draftContent.split(/\r?\n/);
        const idx = lines.findIndex((l) => /^Subject:/i.test(l));
        if (idx >= 0) {
          const subject = lines[idx].replace(/^Subject:/i, "").trim() || "Buyer response";
          const bodyLines = lines.slice(idx + 1);
          while (bodyLines.length && bodyLines[0].trim().length === 0) bodyLines.shift();
          return { subject, body: bodyLines.join("\n") };
        }
        return { subject: "Buyer response", body: draftContent };
      })();

      const reviewRequired = Boolean(response?.approval?.requiresApproval);

      const comm = communicationEngine.createDraft({
        communicationId,
        channel: communicationChannel,
        recipient: String(clientName ?? response?.caseSummary?.clientName ?? "Recipient"),
        subject,
        body,
        reviewRequired,
        createdAtISO: runtimeInput?.nowISO,
      });

      response.communication = comm;
    }

    return response;
  }

  /**
   * Applies an approval decision and marks the work item as completed.
   *
   * @param {object} input
   * @param {string} input.workItemId
   * @param {"APPROVE"|"REJECT"} input.decision
   * @returns {object} Updated ReviewWorkResponse business contract
   */
  async applyApprovalDecision({
    workItemId,
    decision,
    companyRuntime,
    approvedBy,
  }) {
    const key = String(workItemId);
    const session = this.sessions.get(key);
    if (!session?.response) {
      throw new Error(`No in-memory review session found for workItemId=${key}`);
    }

    if (decision !== "APPROVE" && decision !== "REJECT") {
      throw new Error(`Invalid decision: ${decision}`);
    }

    const response = session.response;

    const requiresApproval = false;
    const completionTimeISO = new Date().toISOString();

    if (decision === "APPROVE") {
      response.approval.requiresApproval = requiresApproval;
      response.approval.primaryAction = "Approve";
      response.approval.statusLabel = "Completed";
      response.approval.governanceNote =
        "Governance decision recorded. The draft is approved within governance boundaries.";

      // When ReviewWorkflow approves, create an APPROVED Communication.
      if (companyRuntime) {
        const { CommunicationEngine } = await import("../communication/CommunicationEngine.js");
        const communicationEngine = new CommunicationEngine({ runtime: companyRuntime });
        const communicationId = `comm_${key}`;

        const comm = communicationEngine.approveCommunication({
          communicationId,
          approvedBy: String(approvedBy ?? "Review Workflow"),
          approvedAtISO: completionTimeISO,
        });
        response.communication = comm;
      }
    } else {
      response.approval.requiresApproval = requiresApproval;
      response.approval.primaryAction = "Reject";
      response.approval.statusLabel = "Rejected";
      response.approval.governanceNote =
        "Governance decision recorded. The draft is rejected and will require revised next steps.";

      if (companyRuntime) {
        const { CommunicationEngine } = await import("../communication/CommunicationEngine.js");
        const communicationEngine = new CommunicationEngine({ runtime: companyRuntime });
        const communicationId = `comm_${key}`;
        const comm = communicationEngine.rejectCommunication({
          communicationId,
          rejectedAtISO: completionTimeISO,
          rejectedBy: String(approvedBy ?? "Review Workflow"),
        });
        response.communication = comm;
      }
    }

    response.caseSummary.status = "Completed";

    // Record completion as a lightweight Activity (business-only).
    response.activities = Array.isArray(response.activities) ? response.activities : [];
    response.activities.push({
      timestampISO: completionTimeISO,
      text:
        decision === "APPROVE"
          ? "Approval completed and work marked as completed."
          : "Rejection completed and work marked as completed.",
      category: "governance",
    });

    session.decision = decision;
    session.response = response;

    return response;
  }
}

