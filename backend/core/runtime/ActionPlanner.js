/**
 * ActionPlanner
 *
 * Sprint 3 (Runtime MVP) component:
 * - Converts a business decision into a deterministic execution plan.
 * - Does NOT execute actions.
 * - Does NOT call AI.
 * - Does NOT call providers.
 * - Does NOT perform side effects.
 */
export class ActionPlanner {
  constructor() {
    // Pure deterministic logic only.
  }

  /**
   * @param {object} decisionResult
   * @param {string} decisionResult.decision
   * @param {string} [decisionResult.reason]
   * @param {boolean} [decisionResult.requiresApproval]
   *
   * @returns {{
   *   action: string,
   *   nextStep: string,
   *   requiresApproval: boolean,
   *   reason: string
   * }}
   */
  plan(decisionResult) {
    const decision = decisionResult?.decision;
    const requiresApproval = Boolean(decisionResult?.requiresApproval);
    const reason = decisionResult?.reason ?? "";

    const mapped = this.#mapDecision(decision);

    return {
      action: mapped.action,
      nextStep: mapped.nextStep,
      requiresApproval: mapped.requiresApprovalOverride ?? requiresApproval,
      reason: this.#buildReason(decision, reason),
    };
  }

  #buildReason(decision, upstreamReason) {
    const parts = [
      "ActionPlanner mapped a deterministic decision to an execution plan.",
      decision ? `Decision: ${decision}` : null,
      upstreamReason ? `Upstream reason: ${upstreamReason}` : null,
    ].filter(Boolean);

    return parts.join(" ");
  }

  #mapDecision(decision) {
    switch (decision) {
      case "WAIT":
        return { action: "WAIT", nextStep: "NONE", requiresApprovalOverride: false };
      case "DRAFT_CASE_UPDATE":
        return { action: "CREATE_DRAFT", nextStep: "ATTORNEY_REVIEW", requiresApprovalOverride: true };
      case "DRAFT_REASSURANCE_UPDATE":
        return { action: "CREATE_DRAFT", nextStep: "ATTORNEY_REVIEW", requiresApprovalOverride: true };
      case "ESCALATE":
        return { action: "ESCALATE_TO_ATTORNEY", nextStep: "ATTORNEY_RESPONSE", requiresApprovalOverride: false };
      case "REQUEST_MORE_INFORMATION":
        return { action: "REQUEST_INFORMATION", nextStep: "WAIT_FOR_INFORMATION", requiresApprovalOverride: false };
      default:
        return { action: "REQUEST_INFORMATION", nextStep: "WAIT_FOR_INFORMATION", requiresApprovalOverride: false };
    }
  }
}

