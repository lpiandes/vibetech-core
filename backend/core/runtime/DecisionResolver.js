/**
 * DecisionResolver
 *
 * Sprint 2 (Decision Runtime) component:
 * - Receives a classified business situation (from SituationEvaluator)
 * - Selects the correct business decision deterministically
 * - Does NOT generate text
 * - Does NOT call AI
 * - Does NOT call providers
 * - Does NOT perform actions
 */

export class DecisionResolver {
  constructor() {
    // No dependencies in Sprint 2; deterministic mapping only.
  }

  /**
   * @param {object} situationResult
   * @param {string} situationResult.situation
   * @param {number} situationResult.confidence
   * @param {string} situationResult.reason
   *
   * @returns {{
   *   decision: string,
   *   reason: string,
   *   requiresApproval: boolean
   * }}
   */
  resolve(situationResult) {
    const situation = situationResult?.situation;
    const confidence = situationResult?.confidence;
    const reason = situationResult?.reason;

    const decision = this.#decisionForSituation(situation);
    const requiresApproval = this.#requiresApproval(decision);

    const outReason = [
      "DecisionResolver selected a deterministic decision based on situation mapping.",
      reason ? `Classification reason: ${reason}` : null,
      confidence !== undefined ? `Confidence: ${String(confidence)}` : null,
    ]
      .filter(Boolean)
      .join(" ");

    return {
      decision,
      reason: outReason,
      requiresApproval,
    };
  }

  #decisionForSituation(situation) {
    switch (situation) {
      case "WAITING_ON_EXTERNAL_PARTY":
        return "WAIT";
      case "CLIENT_REQUESTED_UPDATE":
        return "DRAFT_CASE_UPDATE";
      case "NO_MEANINGFUL_ACTIVITY":
        return "WAIT";
      case "MEANINGFUL_CASE_EVENT":
        return "DRAFT_CASE_UPDATE";
      case "URGENT_CASE_ACTIVITY":
        return "ESCALATE";
      case "LONG_TIME_WITHOUT_UPDATE":
        return "DRAFT_REASSURANCE_UPDATE";
      case "LOW_CONFIDENCE":
        return "REQUEST_MORE_INFORMATION";
      case "UNKNOWN":
        return "REQUEST_MORE_INFORMATION";
      default:
        return "REQUEST_MORE_INFORMATION";
    }
  }

  #requiresApproval(decision) {
    // Only decisions that draft client communications require attorney approval.
    switch (decision) {
      case "DRAFT_CASE_UPDATE":
      case "DRAFT_REASSURANCE_UPDATE":
        return true;
      default:
        return false;
    }
  }
}

